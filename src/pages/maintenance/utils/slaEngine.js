/**
 * slaEngine.js
 * Centralized utility for computing SLA status dynamically based on backend configuration.
 */

export const SLAEngine = {
  /**
   * Calculates current SLA status (Ok, At Risk, Breached) based on config and timestamps
   */
  calculateStatus(ticket, config) {
    if (!ticket || !config) return { status: 'unknown', hoursLeft: 0, isBreached: false };
    
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      return { status: 'completed', hoursLeft: 0, isBreached: false };
    }

    const start = new Date(ticket.created_at).getTime();
    const now = new Date().getTime();
    const elapsedHours = (now - start) / (1000 * 60 * 60);

    let allowedHours = config.normal_sla_hours;
    switch(ticket.priority?.toLowerCase()) {
      case 'critical': allowedHours = config.critical_sla_hours; break;
      case 'high': allowedHours = config.high_sla_hours; break;
      case 'low': allowedHours = config.low_sla_hours; break;
    }

    const hoursLeft = allowedHours - elapsedHours;
    const isBreached = hoursLeft < 0;
    
    // At risk if less than 25% time remains
    const isAtRisk = !isBreached && hoursLeft < (allowedHours * 0.25);

    return {
      status: isBreached ? 'breached' : (isAtRisk ? 'at_risk' : 'ok'),
      hoursLeft,
      isBreached,
      isAtRisk,
      allowedHours
    };
  }
};


