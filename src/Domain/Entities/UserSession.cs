namespace ZxcBank.Domain.Entities;

public class UserSession : BaseAuditableEntity
{
    public string UserId { get; set; } = string.Empty; 
    public string DeviceInfo { get; set; } = string.Empty;

    public string IpAddress { get; set; } = string.Empty;
    
    public string Location { get; set; } = string.Empty;
}
