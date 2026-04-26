using System.Collections.Generic;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using ZxcBank.Application.Stocks.Queries.GetStockQuote;
using ZxcBank.Application.Stocks.Queries.GetStocks;
using ZxcBank.Application.Stocks.Commands.BuyStock;

namespace ZxcBank.Web.Endpoints;

public class Stocks : EndpointGroupBase
{
    public override void Map(RouteGroupBuilder group)
    {
        group.RequireAuthorization()
            .MapGet(GetStockQuote, "{ticker}");
        
        group.RequireAuthorization()
            .MapGet(GetStocksList, "list");
        
        group.RequireAuthorization()     
            .MapPost(BuyStock, "buy");
    }

    public async Task<StockQuoteDto> GetStockQuote(ISender sender, string ticker)
    {
        GetStockQuoteQuery query = new GetStockQuoteQuery(ticker);
        return await sender.Send(query);
    }

    public async Task<List<StockItemDto>> GetStocksList(ISender sender, [FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10)
    {
        GetStocksQuery query = new GetStocksQuery(pageNumber, pageSize);
        return await sender.Send(query);
    }

    public async Task<int> BuyStock(ISender sender, [FromBody] BuyStockCommand command)
    {
        return await sender.Send(command);
    }
}
