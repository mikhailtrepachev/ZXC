using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using ZxcBank.Application.UserSessions.Queries.GetUserSessions; // Добавили using для запроса

namespace ZxcBank.Web.Endpoints;

public class UserSessions : EndpointGroupBase
{
    public override void Map(RouteGroupBuilder app)
    {
        // ДОБАВЛЯЕМ НОВЫЙ МЕТОД GET:
        app.MapGet(GetUserSessions).RequireAuthorization();
    }

    // ДОБАВЛЯЕМ САМ ОБРАБОТЧИК:
    public async Task<List<UserSessionDto>> GetUserSessions(ISender sender)
    {
        // Отправляем пустой запрос, MediatR сам найдет наш GetUserSessionsQueryHandler
        return await sender.Send(new GetUserSessionsQuery());
    }
}
