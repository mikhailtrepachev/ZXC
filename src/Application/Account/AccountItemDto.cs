using ZxcBank.Domain.Entities;

namespace ZxcBank.Application.Account;

public class AccountItemDto
{
    public int Id { get; set; }
    public string AccountNumber { get; set; } = string.Empty;
    public decimal Balance { get; set; }
    public string Currency { get; set; } = string.Empty; // "RUB", "USD"
    public string Type { get; set; } = string.Empty;     // "Debet", "Investment"
    public bool IsFrozen { get; set; }
}
