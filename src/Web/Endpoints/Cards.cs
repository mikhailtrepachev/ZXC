using ZxcBank.Application.Cards.Queries.GetCards; // <--- Подключаем Query
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection.Card;
using ZxcBank.Application.Cards.Commands.CreateCard;
using ZxcBank.Application.Cards.Commands.SetCardTemporaryBlock;
using ZxcBank.Application.Cards.Commands.UpdateCardLimit;

namespace ZxcBank.Web.Endpoints;

public class Cards : EndpointGroupBase
{
    public override void Map(RouteGroupBuilder group)
    {
        group.RequireAuthorization(); // Только для вошедших

        // POST /api/Cards/create
        group.MapPost("create", CreateCard);
        
        // GET /api/Cards/list
        group.MapGet("list", GetCards);
        group.MapPut("{id:int}/limit", UpdateLimit);
        group.MapPut("{id:int}/temporary-block", SetTemporaryBlock);
    }

    // Создание карты
    public async Task<int> CreateCard(ISender sender, [FromBody] CreateCardCommand command)
    {
        return await sender.Send(command);
    }

    // Получение списка карт
    public async Task<List<CardDto>> GetCards(ISender sender)
    {
        return await sender.Send(new GetCardsQuery());
    }

    public async Task<IResult> UpdateLimit(ISender sender, int id, [FromBody] UpdateCardLimitRequest request)
    {
        await sender.Send(new UpdateCardLimitCommand
        {
            CardId = id,
            DailyLimit = request.DailyLimit
        });

        return Results.Ok();
    }

    public async Task<IResult> SetTemporaryBlock(ISender sender, int id, [FromBody] SetCardTemporaryBlockRequest request)
    {
        await sender.Send(new SetCardTemporaryBlockCommand
        {
            CardId = id,
            Blocked = request.Blocked
        });

        return Results.Ok();
    }
}

public record UpdateCardLimitRequest(decimal DailyLimit);

public record SetCardTemporaryBlockRequest(bool Blocked);
