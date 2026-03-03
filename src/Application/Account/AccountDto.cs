namespace ZxcBank.Application.Account;

public class AccountDto
{
    public required string FullName { get; set; } // Имя из Identity
    public required string Email { get; set; }    // Email из Identity
    public required string AccountNumber { get; set; } // Номер счета
    public decimal Balance { get; set; }      // Текущий баланс
    public decimal DailyLimit { get; set; }   // Лимит из таблицы Client
    
    // TODO: Список карт пользователя
}
