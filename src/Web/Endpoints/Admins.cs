using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using ZxcBank.Application.Account;
using ZxcBank.Application.Admin.Commands.DeleteAccount;
using ZxcBank.Application.UserSessions.Queries.GetUserLogsForAdmin;
using ZxcBank.Application.UserSessions.Queries.GetUserSessions;

namespace ZxcBank.Web.Endpoints;

public class Admins : EndpointGroupBase
{
    public override void Map(RouteGroupBuilder app)
    {
        // 1. Изменили POST на PUT, и добавили account/{id}/freeze !
        app.MapPut(FreezeAccount, "account/{id}/freeze")
           .RequireAuthorization(policy => policy.RequireRole("Administrator"));

        // 2. Удаление (оставляем как было)
        app.MapDelete(DeleteAccount, "account/{id}")
           .RequireAuthorization(policy => policy.RequireRole("Administrator"));

        // 3. Логи (оставляем как было)
        app.MapGet(GetUserLogs, "logs/{userId}")
           .RequireAuthorization(policy => policy.RequireRole("Administrator"));
    }

    // ОБНОВЛЕННЫЙ МЕТОД ФРИЗА:
    // Теперь он принимает int id из URL, и команду FreezeAccountCommand из JSON
    public async Task FreezeAccount(ISender sender, int id, FreezeAccountCommand command)
    {
        // Мы берем ID из URL, а статус заморозки (Freeze: true/false) из присланного JSON.
        // И собираем это в новую команду:
        var commandWithId = new FreezeAccountCommand
        {
            AccountId = id,
            Freeze = command.Freeze
        };

        await sender.Send(commandWithId);
    }

    public async Task DeleteAccount(ISender sender, int id)
    {
        await sender.Send(new DeleteAccountCommand(id));
    }

    public async Task<List<UserSessionDto>> GetUserLogs(ISender sender, string userId)
    {
        return await sender.Send(new GetUserLogsForAdminQuery(userId));
    }
}
