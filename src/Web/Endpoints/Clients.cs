using Microsoft.AspNetCore.Mvc;
using ZxcBank.Application.Auth.Commands;

namespace ZxcBank.Web.Endpoints;

public class Clients : EndpointGroupBase
{
    public override void Map(RouteGroupBuilder group)
    {
        group.MapPost("register", RegisterClient); 
    }

    public async Task<string> RegisterClient(ISender sender, [FromBody] RegisterClientCommand command)
    {
        return await sender.Send(command);
    }
}
