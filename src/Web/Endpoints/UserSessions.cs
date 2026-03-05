using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using ZxcBank.Application.UserSessions.CreateUserSession;
using ZxcBank.Application.UserSessions.Queries.GetUserSessions; // Добавили using для запроса

namespace ZxcBank.Web.Endpoints;

public class UserSessions : EndpointGroupBase
{
    public override void Map(RouteGroupBuilder app)
    {
        app.MapPost(CreateUserSession).RequireAuthorization();

        // ДОБАВЛЯЕМ НОВЫЙ МЕТОД GET:
        app.MapGet(GetUserSessions).RequireAuthorization();
    }

    public async Task<int> CreateUserSession(ISender sender, CreateUserSessionCommand command)
    {
        return await sender.Send(command);
    }

    // ДОБАВЛЯЕМ САМ ОБРАБОТЧИК:
    public async Task<List<UserSessionDto>> GetUserSessions(ISender sender)
    {
        // Отправляем пустой запрос, MediatR сам найдет наш GetUserSessionsQueryHandler
        return await sender.Send(new GetUserSessionsQuery());
    }
}
