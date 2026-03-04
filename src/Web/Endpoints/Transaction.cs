using Microsoft.AspNetCore.Mvc;
using ZxcBank.Application.Transaction;
using ZxcBank.Application.Transactions.Commands.TransferMoney;

namespace ZxcBank.Web.Endpoints;

public class Transaction : EndpointGroupBase
{
    public override void Map(RouteGroupBuilder group)
    {
        group.RequireAuthorization().MapPost(TransferMoney, "transfer");
        group.RequireAuthorization().MapPost(GetConversionEstimate, "conversion-estimate");

        group.RequireAuthorization().MapGet(GetHistory, "history");

        group.RequireAuthorization().MapGet(GetRecipientPreview, "recipient/{accountNumber}");
    }

    public async Task<int> TransferMoney(ISender sender, [FromBody] TransferMoneyCommand command)
    {
        return await sender.Send(command);
    }

    public async Task<List<TransactionDto>> GetHistory(ISender sender)
    {
        return await sender.Send(new GetTransactionsQuery());
    }

    public async Task<ConversionEstimateDto> GetConversionEstimate(ISender sender, [FromBody] GetConversionEstimateQuery query)
    {
        return await sender.Send(query);
    }

    public async Task<IResult> GetRecipientPreview(ISender sender, string accountNumber)
    {
        var recipient = await sender.Send(new GetTransferRecipientQuery(accountNumber));

        if (recipient == null)
        {
            return Results.NotFound("Ucet prijemce nebyl nalezen.");
        }

        return Results.Ok(recipient);
    }
}
