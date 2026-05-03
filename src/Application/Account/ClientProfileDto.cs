namespace ZxcBank.Application.Account;

public class ClientProfileDto
{
    public string FullName { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    
    // Лимиты относятся к клиенту, а не к конкретному счету
    public decimal DailyTransferLimit { get; set; }
    public decimal InternetPaymentLimit { get; set; }

    // Список счетов
    public List<GetAccountInfoQueryHandler.AccountItemDto> Accounts { get; set; } = new();
}
