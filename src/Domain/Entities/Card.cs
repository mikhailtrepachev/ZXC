namespace ZxcBank.Domain.Entities;

public class Card : BaseAuditableEntity
{
    public int AccountId { get; set; }
    public Account Account { get; set; } = null!;

    public string CardNumber { get; set; } = null!;
    public string CardHolderName { get; set; } = null!;
    
    public string ExpiryDate { get; set; } = null!;
    public string Cvv { get; set; } = null!;
    
    public string PinCodeHash { get; set; } = null!;
    
    public bool IsActive { get; set; } = true;
    public bool IsTemporarilyBlocked { get; set; } = false;
    public decimal DailyLimit { get; set; } = 50000;
    public bool IsVirtual { get; set; } = false; // Виртуальная или Пластик
}
