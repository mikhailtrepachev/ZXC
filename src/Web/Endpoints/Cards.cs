using ZxcBank.Application.Cards.Queries.GetCards; // <--- Подключаем Query
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection.Card;
using ZxcBank.Application.Cards.Commands.CreateCard;

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
}
