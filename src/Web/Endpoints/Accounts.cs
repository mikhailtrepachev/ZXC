using ZxcBank.Application.Account;

namespace ZxcBank.Web.Endpoints;

public class Accounts : EndpointGroupBase
{
    public override void Map(RouteGroupBuilder group)
    {
        // Группа маршрутов будет /api/Accounts (автоматически по имени класса)
        group.RequireAuthorization()
            .MapGet(GetAccountInfo, "info"); // GET /api/Accounts/info
    }

    public async Task<ClientProfileDto> GetAccountInfo(ISender sender)
    {
        return await sender.Send(new GetAccountInfoQuery());
    }
}
