using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection.Auth.Account;

namespace ZxcBank.Web.Endpoints;

public class Transaction : EndpointGroupBase
{
    public override void Map(RouteGroupBuilder group)
    {
        group.RequireAuthorization() // <--- ОБЯЗАТЕЛЬНО! Нужен токен
            .MapPost(TransferMoney, "transfer");
    }

    public async Task<int> TransferMoney(ISender sender, [FromBody] TransferMoneyCommand command)
    {
        return await sender.Send(command);
    }
}
