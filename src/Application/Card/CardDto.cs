namespace Microsoft.Extensions.DependencyInjection.Card;

public class CardDto
{
    public int Id { get; set; }
    public required string MaskedNumber { get; set; } // **** 1234
    public required string HolderName { get; set; }
    public required string ExpiryDate { get; set; }
    public required string Cvv { get; set; } // Обычно CVV не показывают в списке, но для хакатона можно
    public required string AccountNumber { get; set; }
    public bool IsVirtual { get; set; }
    public bool IsActive { get; set; }
    public bool IsTemporarilyBlocked { get; set; }
    public decimal DailyLimit { get; set; }
}
