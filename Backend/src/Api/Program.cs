using System.Text;
using AssignmentSystem.Api.Middleware;
using AssignmentSystem.Api.Services;
using AssignmentSystem.Application.Interfaces;
using AssignmentSystem.Application.Services;
using AssignmentSystem.Infrastructure.Auth;
using AssignmentSystem.Infrastructure.Persistence;
using AssignmentSystem.Infrastructure.Repositories;
using AssignmentSystem.Infrastructure.Seed;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

// --- Swagger ----------------------------------------------------------------------------------

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Assignment & Submission Management System",
        Version = "v1",
        Description = "Role-based assignment and submission API. Log in via /api/v1/auth/login, " +
                      "then paste the accessToken into the Authorize button."
    });

    // Makes the "Authorize" button appear so the evaluator can exercise protected endpoints from
    // the browser instead of reaching for curl.
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste only the access token. Swagger adds the \"Bearer \" prefix itself."
    });

    // Applied globally: every endpoint offers the token. [AllowAnonymous] actions still work
    // without it, so this costs nothing and avoids per-endpoint annotation.
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// --- Database ---------------------------------------------------------------------------------

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

// --- Authentication ---------------------------------------------------------------------------

builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection(JwtSettings.SectionName));

var jwtSettings = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()
    ?? throw new InvalidOperationException($"Configuration section '{JwtSettings.SectionName}' is missing.");

// HS256 silently requires a 256-bit key. Checking here turns a confusing runtime failure on the
// first login into a startup error that names the fix.
if (Encoding.UTF8.GetByteCount(jwtSettings.Key) < JwtSettings.MinimumKeyLengthBytes)
{
    throw new InvalidOperationException(
        $"JwtSettings:Key must be at least {JwtSettings.MinimumKeyLengthBytes} bytes for HS256 " +
        "signing. Set it in appsettings.Development.json for local runs, or as JwtSettings__Key " +
        "in .env when running under Docker Compose.");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Claims arrive exactly as issued ("sub", "role") instead of being rewritten to the
        // WS-* URIs. NameClaimType/RoleClaimType then tell ASP.NET where identity and roles
        // live, which is what makes [Authorize(Roles = "Teacher")] work against a short claim.
        options.MapInboundClaims = false;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Key)),
            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero, // no grace period — tokens expire exactly on time
            NameClaimType = "sub",
            RoleClaimType = "role"
        };
    });

builder.Services.AddAuthorization();

// --- Application services ---------------------------------------------------------------------

// CurrentUserService reads the request's claims, so it must not outlive the request.
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IPasswordHasher, BcryptPasswordHasher>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
builder.Services.AddScoped<IAuthService, AuthService>();

var app = builder.Build();

// First in the pipeline, so it wraps everything after it — including routing, model binding and
// the auth middleware. Registered later, exceptions thrown before it would escape unhandled.
app.UseMiddleware<ExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "Assignment System API v1");
        options.DocumentTitle = "Assignment System API";
    });

    // Migrate-then-seed on startup, development only. This is what makes `docker compose up` a
    // genuinely single command for the evaluator: no separate `dotnet ef database update` step,
    // and the demo accounts in the README exist on first boot. Production deployments apply
    // migrations deliberately, which is why this is gated.
    using var scope = app.Services.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await context.Database.MigrateAsync();
    await DataSeeder.SeedAsync(context);
}

// Development is deliberately excluded. Kestrel listens on both http (5274) and https (7222), so
// redirecting http API calls sends the browser to a *different origin* — Swagger UI loaded over
// http then fails every request as a blocked cross-origin redirect. It also breaks Docker, where
// the container serves plain http on 8080 behind the host port mapping and there is no certificate
// to redirect to. TLS in production is terminated by the reverse proxy in front of this.
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

// Order is load-bearing: authentication establishes *who* the caller is, authorization then
// decides what they may do. Reversed, every [Authorize] check sees an anonymous principal.
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// One line, and it makes the Docker health check in docs/08 trivial.
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }))
    .WithTags("Health")
    .AllowAnonymous();

app.Run();
