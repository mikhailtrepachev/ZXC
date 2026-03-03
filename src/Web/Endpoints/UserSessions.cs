using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using ZxcBank.Application.UserSessions.Commands.CreateUserSession;

namespace ZxcBank.Web.Endpoints;

public class UserSessions : EndpointGroupBase
{
    public override void Map(RouteGroupBuilder app)
    {
        // RequireAuthorization() означает, что метод сработает ТОЛЬКО если есть JWT токен!
        app.MapPost(CreateUserSession).RequireAuthorization();
    }

    public async Task<int> CreateUserSession(ISender sender, CreateUserSessionCommand command)
    {
        return await sender.Send(command);
    }
}
