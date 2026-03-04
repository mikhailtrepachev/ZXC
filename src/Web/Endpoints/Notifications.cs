using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using ZxcBank.Application.Notifications.Queries.GetNotifications;

namespace ZxcBank.Web.Endpoints;

public class Notifications : EndpointGroupBase
{
    public override void Map(RouteGroupBuilder app)
    {
        // Создаем GET-запрос: /api/Notifications
        // RequireAuthorization() означает, что анонимов не пустим, нужен токен
        app.MapGet(GetNotifications).RequireAuthorization();
    }

    public async Task<List<NotificationDto>> GetNotifications(ISender sender)
    {
        // Отправляем запрос через MediatR
        return await sender.Send(new GetNotificationsQuery());
    }
}
