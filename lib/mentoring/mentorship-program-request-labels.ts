/**
 * Human-readable labels for `mentorship_program_requests` (admin tables).
 */
export function mentorshipProgramRequestStatusLabel(status: string): string {
  switch (status) {
    case "resolved":
      return "Closed";
    default:
      return status;
  }
}

export function mentorshipProgramRequestTypeLabel(type: string): string {
  switch (type) {
    case "new_hire_help":
      return "New Hire Needs Mentor";
    case "mentor_interest":
      return "Interested in Mentoring";
    case "mentor_no_mentees":
      return "Mentor Has No Mentees";
    default:
      return type;
  }
}
