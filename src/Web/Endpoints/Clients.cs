using Microsoft.AspNetCore.Identity.Data;
using Microsoft.AspNetCore.Mvc;
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
        group.MapPost("logout", LogoutUser).RequireAuthorization();
    }

    public async Task<string> RegisterClient(ISender sender, [FromBody] RegisterClientCommand command)
    {
        return await sender.Send(command);
    }

    public async Task<string> Login(ISender sender, HttpContext context, [FromBody] LoginRequestDto request)
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
        
        return await sender.Send(command);
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

    public async Task<IResult> LogoutUser(ISender sender, HttpContext context)
    {
        string authHeader = context.Request.Headers.Authorization.ToString();

        if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer "))
        {
            return Results.BadRequest("Invalid token");
        }
        
        string token = authHeader.Substring("Bearer ".Length).Trim();

        bool result = await sender.Send(new LogoutCommand(token));

        if (result)
        {
            return Results.Ok("Successfully logged out");
        }
        
        return Results.BadRequest("Failed to logout");
    }
}
