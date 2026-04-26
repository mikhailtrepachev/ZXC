using ZxcBank.Application.Stocks.Queries.GetStockQuote;

namespace ZxcBank.Application.Common.Interfaces;

public interface IStockService
{
    Task<StockQuoteDto> GetQuoteAsync(string ticker, CancellationToken cancellationToken);
}