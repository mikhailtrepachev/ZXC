using Microsoft.AspNetCore.Mvc;
using ZxcBank.Application.Transaction;
using ZxcBank.Application.Transactions.Commands.TransferMoney;

namespace ZxcBank.Web.Endpoints;

public class Transaction : EndpointGroupBase
{
    public override void Map(RouteGroupBuilder group)
    {
        group.RequireAuthorization() // Токен обязателен для всей группы
            .MapPost(TransferMoney, "transfer");
            
        group.RequireAuthorization()
            // POST /api/Transaction/transfer
            .MapGet(GetHistory, "history");     // GET /api/Transaction/history <--- НОВОЕ
    }

    public async Task<int> TransferMoney(ISender sender, [FromBody] TransferMoneyCommand command)
    {
        return await sender.Send(command);
    }

    // Новый метод для получения списка
    public async Task<List<TransactionDto>> GetHistory(ISender sender)
    {
        // Отправляем запрос (Query) в Application слой
        return await sender.Send(new GetTransactionsQuery());
    }
}
