using System.Text.Json.Serialization;

namespace ZxcBank.Application.Financial;

public record FinnhubNewsItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("category")]
    public required string Category { get; init; }

    // Finnhub присылает время в формате Unix timestamp (секунды)
    [JsonPropertyName("datetime")]
    public required long Datetime { get; init; }

    [JsonPropertyName("headline")]
    public required string Headline { get; init; }

    [JsonPropertyName("image")]
    public required string Image { get; init; }

    [JsonPropertyName("source")]
    public required string Source { get; init; }

    [JsonPropertyName("summary")]
    public required string Summary { get; init; }

    [JsonPropertyName("url")]
    public required string Url { get; init; }
}
