using Microsoft.AspNetCore.SignalR;
using ZxcBank.Application.Common.Security;

namespace ZxcBank.Web.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    
}
