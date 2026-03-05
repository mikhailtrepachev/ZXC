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
    }

    public async Task<string> RegisterClient(ISender sender, [FromBody] RegisterClientCommand command)
    {
        return await sender.Send(command);
    }

    public async Task<string> Login(ISender sender, [FromBody] LoginCommand command)
    {
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
}
