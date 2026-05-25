/**
 * Finance-specific event handlers
 */
import { processFinanceNudge } from '../nudges/financeNudges';

/**
 * Handle dormant user with finance intent
 */
export async function handleDormantFinanceUser(user): Promise<void> {
  // Check if user's last intent was financial
  if (user.lastIntent.includes('loan') ||
      user.lastIntent.includes('credit') ||
      user.lastIntent.includes('finance')) {
    await processFinanceNudge({
      ...user,
      becameDormant: true,
    });
  }
}

/**
 * Handle loan EMI due reminder
 */
export async function handleEMIDueReminder(user): Promise<void> {
  if (user.nextEMIAmount && user.nextEMIDueDate) {
    await processFinanceNudge(user);
  }
}

/**
 * Handle credit score improvement
 */
export async function handleScoreImprovement(user): Promise<void> {
  if (user.previousScore && user.newScore && user.newScore > user.previousScore) {
    await processFinanceNudge({
      ...user,
      scoreImprovement: user.newScore - user.previousScore,
    });
  }
}

/**
 * Handle loan approval - send congratulations
 */
export async function handleLoanApproval(userId: string, loan): Promise<void> {
  await processFinanceNudge({
    userId,
    event: 'loan_approved',
    loanAmount: loan.amount,
    approvedAt: new Date(),
  });
}

/**
 * Handle payment overdue
 */
export async function handlePaymentOverdue(userId: string, data): Promise<void> {
  await processFinanceNudge({
    userId,
    event: 'payment_overdue',
    overdueDays: data.overdueDays,
    overdueAmount: data.amount,
  });
}
