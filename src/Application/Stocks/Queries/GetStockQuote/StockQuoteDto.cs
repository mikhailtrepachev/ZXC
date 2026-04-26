namespace ZxcBank.Application.Stocks.Queries.GetStockQuote;

public record StockQuoteDto
{
    public string Ticker { get; init; } = string.Empty;
    public decimal CurrentPrice { get; init; }
    public decimal ChangePercent { get; init; }
    public string Currency { get; init; } = string.Empty;
}