namespace AssignmentSystem.Domain.Entities;

// A discussion thread hanging off one assignment. Two levels of *structure* — a comment and its replies —
// but a conversation of any length inside the second level.
//
// Those are different things, and separating them is the point. Anyone can reply to anyone, including to
// a reply; what a reply-to-a-reply does NOT do is create a third level. It is stored as another reply to
// the same top-level comment, with ReplyToCommentId recording who it was actually addressed to, and the
// UI renders that as an @mention instead of another indent.
//
// Why not true nesting: ParentCommentId is a self-reference, so the schema would happily store a reply to
// a reply to a reply — and then the read becomes an unbounded recursive query and the UI has to indent
// forever, squeezing the text column to nothing about four levels down. Flattening keeps the read a
// single non-recursive query and keeps every reply the same width, while losing nothing: the thing a
// nested reply actually conveys is "this answers *you*", which the mention says outright rather than
// leaving to be inferred from indentation.
//
// Deletion is soft. A hard delete of a parent would take its replies with it, silently erasing other
// people's words to remove one person's — so IsDeleted blanks the content at the read boundary and the
// thread structure survives. See CommentService.DeleteAsync.
public sealed class Comment
{
    private readonly List<Comment> _replies = [];
    private readonly List<CommentUpvote> _upvotes = [];

    private Comment() { }

    public Guid Id { get; private set; }

    public string Content { get; private set; } = null!;

    // No Assignment navigation on purpose. Callers compare this id against the one in the route and load
    // the assignment through IAssignmentRepository, whose queries carry rules 3, 4 and 6 — a navigation
    // here would be a second, unscoped way to reach the same object.
    public Guid AssignmentId { get; private set; }

    public Guid AuthorId { get; private set; }

    // `internal set` for the same reason as the navigations on Submission and StudentEnrollment: EF
    // fills it, no factory does, and the response needs Author.FullName — so a unit test has to be
    // able to arrange the graph a repository would return. See Domain/AssemblyInfo.cs.
    public User Author { get; internal set; } = null!;

    // Null for a top-level comment. Not a separate entity or a discriminator column: a reply is a
    // comment in every respect except that it points at one.
    //
    // Invariant, enforced in CommentService: this always points at a *top-level* comment. A reply to a
    // reply is normalised onto the same root, which is what keeps the tree two levels deep.
    public Guid? ParentCommentId { get; private set; }

    public Comment? ParentComment { get; internal set; }

    // Who this reply was addressed to, when that is not simply its parent — set only for a reply to a
    // reply, and null otherwise. It is deliberately *not* set when replying straight to a top-level
    // comment: that reply already sits directly under the person it answers, so an @mention there would
    // restate what the position already says.
    //
    // Kept as a foreign key rather than an "@Name" prefix baked into Content, because a name written into
    // the text is a copy that stops being true — it survives the author renaming their account, it can be
    // typed by hand to impersonate a reply that never happened, and the read has to parse it back out.
    // This way the mention is derived from a row that either exists or does not.
    public Guid? ReplyToCommentId { get; private set; }

    public Comment? ReplyTo { get; internal set; }

    // Soft delete. The row stays, the content stops being served — the placeholder the UI shows is
    // rendered from this flag, not from a blanked Content column, so the original text is never
    // destroyed by a mis-click.
    public bool IsDeleted { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public IReadOnlyCollection<Comment> Replies => _replies;

    public IReadOnlyCollection<CommentUpvote> Upvotes => _upvotes;

    // Both ids are passed rather than derived because only the service can work out either one: the
    // proposed target has to belong to the same assignment, and turning "reply to this" into a
    // (root, addressee) pair means reading the target's own ParentCommentId. Neither fact is visible from
    // inside this aggregate.
    public static Comment Create(
        Guid assignmentId,
        Guid authorId,
        string content,
        Guid? parentCommentId = null,
        Guid? replyToCommentId = null)
    {
        return new Comment
        {
            Id = Guid.NewGuid(),
            AssignmentId = assignmentId,
            AuthorId = authorId,
            Content = content,
            ParentCommentId = parentCommentId,
            ReplyToCommentId = replyToCommentId,
            IsDeleted = false,
            CreatedAt = DateTime.UtcNow
        };
    }

    // Idempotent on purpose: deleting an already-deleted comment is not an error worth a round trip to
    // tell someone about, and two moderators clicking at once should not produce a failure.
    //
    // Content is deliberately left intact — see the note on IsDeleted.
    public void SoftDelete() => IsDeleted = true;
}
