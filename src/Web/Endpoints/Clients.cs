using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.Mvc;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using ZxcBank.Application.Account;
using ZxcBank.Application.Auth.Commands;

namespace ZxcBank.Web.Endpoints;

public class Clients : EndpointGroupBase
{
    public override void Map(RouteGroupBuilder group)
    {
        group.MapPost("register", RegisterClient);
        group.MapPost("login", Login);
        group.MapPost("update-info", UpdateClientInfo);
        group.MapPost("limits", UpdateLimits);
        group.MapGet("session", GetSession).RequireAuthorization();
        group.MapPost("logout", LogoutUser).RequireAuthorization();
    }

    public async Task<string> RegisterClient(ISender sender, [FromBody] RegisterClientCommand command)
    {
        return await sender.Send(command);
    }

    public async Task<IResult> Login(
        ISender sender,
        HttpContext context,
        IConfiguration configuration,
        [FromBody] LoginRequestDto request)
    {
        string ipAddress = context.Connection.RemoteIpAddress?.ToString() ?? "Unknown";

        string deviceInfo = context.Request.Headers.UserAgent.ToString();

        if (string.IsNullOrWhiteSpace(deviceInfo))
        {
            deviceInfo = "Unknown Device";
        }

        string location = "Unknown location";

        LoginCommand command = new LoginCommand
        {
            Email = request.Email,
            Password = request.Password,
            IpAddress = ipAddress,
            DeviceInfo = deviceInfo,
            Location = location
        };
        
        string token = await sender.Send(command);

        context.Response.Cookies.Append(
            GetAccessTokenCookieName(configuration),
            token,
            CreateAuthCookieOptions(context, configuration));

        return Results.Ok(CreateSessionDto(token));
    }

    public async Task<IResult> UpdateClientInfo(ISender sender, [FromBody] UpdateClientNameCommand command)
    {
        await sender.Send(command);
        return Results.Ok();
    }

    public async Task<IResult> UpdateLimits(ISender sender, [FromBody] UpdateLimitsCommand command)
    {
        await sender.Send(command);
        return Results.Ok();
    }

    public IResult GetSession(HttpContext context)
    {
        return Results.Ok(CreateSessionDto(context.User));
    }

    public async Task<IResult> LogoutUser(ISender sender, HttpContext context, IConfiguration configuration)
    {
        string? token = ReadBearerToken(context) ??
                        context.Request.Cookies[GetAccessTokenCookieName(configuration)];

        ClearAuthCookie(context, configuration);

        if (string.IsNullOrWhiteSpace(token))
        {
            return Results.Ok("Successfully logged out");
        }

        bool result = await sender.Send(new LogoutCommand(token));

        if (result)
        {
            return Results.Ok("Successfully logged out");
        }
        
        return Results.BadRequest("Failed to logout");
    }

    private static string GetAccessTokenCookieName(IConfiguration configuration)
    {
        return configuration["JwtSettings:CookieName"] ?? "zxc_access_token";
    }

    private static CookieOptions CreateAuthCookieOptions(HttpContext context, IConfiguration configuration)
    {
        double expiryMinutes = 60;
        if (double.TryParse(configuration["JwtSettings:ExpiryMinutes"], out double configuredExpiryMinutes) &&
            configuredExpiryMinutes > 0)
        {
            expiryMinutes = configuredExpiryMinutes;
        }

        return new CookieOptions
        {
            HttpOnly = true,
            Secure = context.Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddMinutes(expiryMinutes),
            Path = "/"
        };
    }

    private static void ClearAuthCookie(HttpContext context, IConfiguration configuration)
    {
        context.Response.Cookies.Delete(
            GetAccessTokenCookieName(configuration),
            new CookieOptions
            {
                HttpOnly = true,
                Secure = context.Request.IsHttps,
                SameSite = SameSiteMode.Lax,
                Path = "/"
            });
    }

    private static string? ReadBearerToken(HttpContext context)
    {
        string authHeader = context.Request.Headers.Authorization.ToString();
        return authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? authHeader["Bearer ".Length..].Trim()
            : null;
    }

    private static AuthSessionDto CreateSessionDto(string token)
    {
        JwtSecurityToken jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        return CreateSessionDto(jwt.Claims);
    }

    private static AuthSessionDto CreateSessionDto(ClaimsPrincipal principal)
    {
        return CreateSessionDto(principal.Claims);
    }

    private static AuthSessionDto CreateSessionDto(IEnumerable<Claim> claims)
    {
        List<Claim> claimList = claims.ToList();
        string userId = FindClaimValue(claimList, ClaimTypes.NameIdentifier, JwtRegisteredClaimNames.Sub);
        string email = FindClaimValue(claimList, ClaimTypes.Email, JwtRegisteredClaimNames.Email, "email");
        List<string> roles = claimList
            .Where(claim => claim.Type == ClaimTypes.Role || claim.Type == "role" || claim.Type == "roles")
            .Select(claim => claim.Value)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new AuthSessionDto
        {
            IsAuthenticated = true,
            UserId = userId,
            Email = email,
            Roles = roles
        };
    }

    private static string FindClaimValue(IEnumerable<Claim> claims, params string[] types)
    {
        foreach (string type in types)
        {
            string? value = claims.FirstOrDefault(claim => claim.Type == type)?.Value;
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return string.Empty;
    }
}

public sealed class AuthSessionDto
{
    public bool IsAuthenticated { get; init; }
    public string UserId { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public IReadOnlyList<string> Roles { get; init; } = Array.Empty<string>();
}
