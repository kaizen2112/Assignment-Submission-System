# ASP.NET Core 9 API image. Two stages: the ~1 GB SDK compiles, the ~220 MB ASP.NET runtime ships.
# Nothing from the build stage survives except the published output, so the compiler, NuGet cache and
# source never reach the final image.
#
# Build context is ./Backend (set in docker-compose.yml), so every path below is relative to that.

# --- build ------------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Project files first, on their own layer. `dotnet restore` is the slow step, and Docker reuses this
# layer as long as no .csproj changed — so editing a controller does not re-download NuGet packages.
# The four are listed individually because restore needs each ProjectReference target to exist.
COPY src/Domain/Domain.csproj src/Domain/
COPY src/Application/Application.csproj src/Application/
COPY src/Infrastructure/Infrastructure.csproj src/Infrastructure/
COPY src/Api/Api.csproj src/Api/
RUN dotnet restore src/Api/Api.csproj

# Restoring the Api project pulls in its references transitively, which is why the test project is
# absent from this image entirely — tests are CI's job, not the runtime image's.
COPY src/ src/
RUN dotnet publish src/Api/Api.csproj -c Release -o /app --no-restore

# --- runtime ----------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime

# The runtime image deliberately ships no HTTP client, so the compose health check has nothing to
# call /health with. curl is ~2 MB and the alternative — a health check that shells out to dotnet —
# would cost far more per probe.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app .

# Plain HTTP on 8080. TLS is not terminated in the container: there is no certificate to present, and
# Program.cs skips UseHttpsRedirection outside production for exactly this reason.
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

# APP_UID is defined by the base image (uid 1654, user `app`). Set after apt-get, which needs root.
USER $APP_UID

ENTRYPOINT ["dotnet", "AssignmentSystem.Api.dll"]
