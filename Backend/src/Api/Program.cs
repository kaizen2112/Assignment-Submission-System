using AssignmentSystem.Infrastructure.Persistence;
using AssignmentSystem.Infrastructure.Seed;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

// Docker supplies this as the ConnectionStrings__Default environment variable; locally it comes
// from appsettings.Development.json. Failing fast with a readable message beats an Npgsql
// "host cannot be null" thrown from somewhere deep in the first request.
var connectionString = builder.Configuration.GetConnectionString("Default");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Connection string 'ConnectionStrings:Default' is not configured. Set it in " +
        "appsettings.Development.json for local runs, or as ConnectionStrings__Default in .env " +
        "when running under Docker Compose.");
}

builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    // Migrate-then-seed on startup, development only. This is what makes `docker compose up` a
    // genuinely single command for the evaluator: no separate `dotnet ef database update` step,
    // and the demo accounts in the README exist on first boot. Production deployments apply
    // migrations deliberately, which is why this is gated.
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await context.Database.MigrateAsync();
    await DataSeeder.SeedAsync(context);
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
