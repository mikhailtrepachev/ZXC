using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Application.Financial;

namespace ZxcBank.Web.Endpoints;

public class MarketData : EndpointGroupBase
{
    public override void Map(RouteGroupBuilder group)
    {
        group.RequireAuthorization();
        
        group.MapGet("news", GetNews);
        group.MapGet("snapshot", GetSnapshot);
    }
    
    private async Task<List<NewsArticleDto>> GetNews(
        IFinancialDataService financialDataService, 
        CancellationToken cancellationToken)
    {
        return await financialDataService.GetLatestNewsAsync(cancellationToken);
    }

    private async Task<MarketSnapshotDto> GetSnapshot(
        IFinancialDataService financialDataService, 
        CancellationToken cancellationToken)
    {
        return await financialDataService.GetMarketSnapshotAsync(cancellationToken);
    }
}
