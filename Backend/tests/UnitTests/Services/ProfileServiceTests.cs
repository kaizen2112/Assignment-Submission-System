using AssignmentSystem.Application.Common;
using AssignmentSystem.Application.DTOs.Profile;
using AssignmentSystem.Application.Services;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.UnitTests.Helpers;
using FluentAssertions;
using Moq;

namespace AssignmentSystem.UnitTests.Services;

// Self-service profile edits.
//
// The rule worth testing here is not "does the name change" — it is what a user *cannot* reach. There is no
// user id in either request, so the interesting assertions are that the caller's own row is the one loaded,
// that email and role survive a name edit untouched, and that a password change is refused without the
// current password.
public sealed class ProfileServiceTests
{
    private static ProfileService Build(MockRepositoryHelper.ServiceMocks mocks) =>
        new(mocks.Users.Object, mocks.PasswordHasher.Object, mocks.CurrentUser.Object);

    [Fact]
    public async Task UpdateMineAsync_ChangesTheNameAndNothingElse()
    {
        // Arrange
        var me = EntityBuilders.Student("Nadia Islam", "nadia@school.edu");

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Users = MockRepositoryHelper.UsersWith(me),
            CurrentUser = MockRepositoryHelper.CurrentUser(me.Id, Role.Student)
        };

        // Act
        var result = await Build(mocks).UpdateMineAsync(
            new UpdateProfileRequest("  Nadia Islam Chowdhury  "), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.FullName.Should().Be("Nadia Islam Chowdhury", "the name is trimmed");

        // The two fields a user must not be able to change about themselves. Asserted on the entity, not only
        // the response: a service that returned the old values while writing new ones would pass a
        // response-only check.
        me.Email.Should().Be("nadia@school.edu");
        me.Role.Should().Be(Role.Student);
        result.Value.Email.Should().Be("nadia@school.edu");
        result.Value.Role.Should().Be(nameof(Role.Student));

        mocks.Users.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once());
    }

    [Fact]
    public async Task UpdateMineAsync_LoadsTheCallerAndNobodyElse()
    {
        // The whole authorization story. There is no id in the request, so the only way this could touch
        // another account is by asking the repository for one — which this asserts it does not.
        var me = EntityBuilders.Teacher();
        var someoneElse = EntityBuilders.Student();

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Users = MockRepositoryHelper.UsersWith(me),
            CurrentUser = MockRepositoryHelper.CurrentUser(me.Id, Role.Teacher)
        };

        await Build(mocks).UpdateMineAsync(new UpdateProfileRequest("New Name"), CancellationToken.None);

        mocks.Users.Verify(r => r.GetByIdAsync(me.Id, It.IsAny<CancellationToken>()), Times.Once());
        mocks.Users.Verify(
            r => r.GetByIdAsync(someoneElse.Id, It.IsAny<CancellationToken>()), Times.Never());
    }

    [Fact]
    public async Task UpdateMineAsync_AnonymousCaller_ReturnsUnauthorizedAndSavesNothing()
    {
        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            CurrentUser = MockRepositoryHelper.AnonymousUser()
        };

        var result = await Build(mocks).UpdateMineAsync(
            new UpdateProfileRequest("Anyone"), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.Unauthorized);
        mocks.Users.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never());
    }

    [Fact]
    public async Task ChangeMyPasswordAsync_CorrectCurrentPassword_RehashesAndSaves()
    {
        var me = EntityBuilders.Teacher();

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Users = MockRepositoryHelper.UsersWith(me),
            CurrentUser = MockRepositoryHelper.CurrentUser(me.Id, Role.Teacher)
        };

        // The current password verifies; the new one does not match the existing hash (so it is a real change).
        mocks.PasswordHasher
            .Setup(h => h.Verify("Correct@123", It.IsAny<string>())).Returns(true);
        mocks.PasswordHasher
            .Setup(h => h.Verify("Brand@New456", It.IsAny<string>())).Returns(false);
        mocks.PasswordHasher.Setup(h => h.Hash("Brand@New456")).Returns("new-hash");

        var result = await Build(mocks).ChangeMyPasswordAsync(
            new ChangePasswordRequest("Correct@123", "Brand@New456"), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();

        // The stored hash is the *new* one, and it went through the hasher rather than being stored raw.
        me.PasswordHash.Should().Be("new-hash");
        mocks.PasswordHasher.Verify(h => h.Hash("Brand@New456"), Times.Once());
        mocks.Users.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once());
    }

    [Fact]
    public async Task ChangeMyPasswordAsync_WrongCurrentPassword_RefusesAndLeavesTheHashAlone()
    {
        var me = EntityBuilders.Teacher();
        var originalHash = me.PasswordHash;

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Users = MockRepositoryHelper.UsersWith(me),
            CurrentUser = MockRepositoryHelper.CurrentUser(me.Id, Role.Teacher)
        };

        mocks.PasswordHasher.Setup(h => h.Verify(It.IsAny<string>(), It.IsAny<string>())).Returns(false);

        var result = await Build(mocks).ChangeMyPasswordAsync(
            new ChangePasswordRequest("WrongGuess1", "Brand@New456"), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();

        // Validation, not Unauthorized. A 401 would tell the client's interceptor the session had expired, and
        // it would try to refresh and then sign the user out over a typo.
        result.ErrorType.Should().Be(ErrorType.Validation);

        me.PasswordHash.Should().Be(originalHash);
        mocks.PasswordHasher.Verify(h => h.Hash(It.IsAny<string>()), Times.Never());
        mocks.Users.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never());
    }

    [Fact]
    public async Task ChangeMyPasswordAsync_NewPasswordSameAsCurrent_IsRefused()
    {
        // Both Verify calls return true: the current password is right, and the "new" one matches the same
        // hash. Silently succeeding would teach the user that a change they did not make had taken effect.
        var me = EntityBuilders.Teacher();

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Users = MockRepositoryHelper.UsersWith(me),
            CurrentUser = MockRepositoryHelper.CurrentUser(me.Id, Role.Teacher)
        };

        mocks.PasswordHasher.Setup(h => h.Verify(It.IsAny<string>(), It.IsAny<string>())).Returns(true);

        var result = await Build(mocks).ChangeMyPasswordAsync(
            new ChangePasswordRequest("Same@1234", "Same@1234"), CancellationToken.None);

        result.IsSuccess.Should().BeFalse();
        result.ErrorType.Should().Be(ErrorType.Validation);
        mocks.PasswordHasher.Verify(h => h.Hash(It.IsAny<string>()), Times.Never());
        mocks.Users.Verify(r => r.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never());
    }

    [Theory]
    [InlineData(Role.Admin)]
    [InlineData(Role.Teacher)]
    [InlineData(Role.Student)]
    public async Task Profile_IsSelfService_ForEveryRole(Role role)
    {
        // No role check anywhere in this service, and that is the design: every role edits their own account.
        // Pinned so nobody "hardens" it by adding one.
        var me = EntityBuilders.Student("Any Person", "any@school.edu");

        var mocks = new MockRepositoryHelper.ServiceMocks
        {
            Users = MockRepositoryHelper.UsersWith(me),
            CurrentUser = MockRepositoryHelper.CurrentUser(me.Id, role)
        };

        var result = await Build(mocks).UpdateMineAsync(
            new UpdateProfileRequest("Renamed"), CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }
}
