namespace ZxcBank.Application.Financial;

public record class MarketSnapshotDto
{
    public required decimal BankIndexPercentChange { get; init; } 
    
    public required decimal EurCzkRate { get; init; }
    public required decimal UsdCzkRate { get; init; }
    
    public required decimal TenYearYieldPercent { get; init; } 
    
    public required DateTime LastUpdated { get; init; }
}
