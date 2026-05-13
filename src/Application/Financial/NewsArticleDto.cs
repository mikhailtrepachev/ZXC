namespace ZxcBank.Application.Financial;

public record class NewsArticleDto
{
    public required string Id { get; init; }
    
    public required string Category { get; init; }
    public required string Title { get; init; } 
    public required string Description { get; init; } 
    
    public required string Source { get; init; } 
    public required DateTime PublishedAt { get; init; }
    
    public required string ReadTime { get; init; } 
    public required string Impact { get; init; } 
    public required string Sentiment { get; init; }
}
