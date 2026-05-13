using ZxcBank.Application.Financial;

namespace ZxcBank.Application.Common.Interfaces;

public interface IFinancialDataService
{
    Task<List<NewsArticleDto>> GetLatestNewsAsync(CancellationToken cancellationToken);
    Task<MarketSnapshotDto> GetMarketSnapshotAsync(CancellationToken cancellationToken);
}
