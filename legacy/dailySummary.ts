export type DailyProgressRow = { userId: number; lessonId: number; percent: number };
export type DailyAssignmentRow = { userId: number; lessonId: number | null; status: "assigned" | "completed" | "reviewed"; dueDate: Date | null };
export type DailyHomeworkRow = { userId: number; lessonId: number | null };
export type DailyAttemptRow = { userId: number; questionId: number; isCorrect: number };
export type DailyAttendanceRow = { userId: number; sessionDate: string; sessionTitle: string; status: "present" | "absent" | "late" | "excused"; joinDurationSeconds: number; engagementEvents: number; submittedWorkCount: number };
export type DailyStudentName = { id: number; name: string | null };

export function buildWeeklyParentReportData(input: {
  studentId: number;
  studentName: string | null;
  weekStart: string;
  weekEnd: string;
  progress: DailyProgressRow[];
  assignments: DailyAssignmentRow[];
  homework: DailyHomeworkRow[];
  attempts: DailyAttemptRow[];
  attendance?: DailyAttendanceRow[];
  questionIds: Set<number>;
  grade9LessonIds: Set<number>;
  now?: Date;
}) {
  const metrics = aggregateDailyStudentMetrics({
    progress: input.progress,
    assignments: input.assignments,
    homework: input.homework,
    attempts: input.attempts,
    attendance: input.attendance,
    questionIds: input.questionIds,
    grade9LessonIds: input.grade9LessonIds,
    names: [{ id: input.studentId, name: input.studentName }],
    now: input.now,
  });
  const student = metrics.students.find((row) => row.userId === input.studentId) ?? {
    userId: input.studentId,
    name: input.studentName || "Unnamed student",
    completedTasks: 0,
    openTasks: 0,
    overdueTasks: 0,
    homeworkSubmissions: 0,
    accuracy: null,
    priorityCohort: false,
    presentSessions: 0,
    absentSessions: 0,
    participationSeconds: 0,
    engagementEvents: 0,
    submittedWorkCount: 0,
    participationRate: null,
    lowEngagement: false,
    followUpType: null,
    recommendation: null,
    taskDraft: null,
    nextAction: "Continue with the next lesson",
  };
  return { weekStart: input.weekStart, weekEnd: input.weekEnd, student, cohort: "middle_school" as const };
}


export function aggregateDailyStudentMetrics(input: {
  progress: DailyProgressRow[];
  assignments: DailyAssignmentRow[];
  homework: DailyHomeworkRow[];
  attempts: DailyAttemptRow[];
  attendance?: DailyAttendanceRow[];
  questionIds: Set<number>;
  grade9LessonIds: Set<number>;
  names: DailyStudentName[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const attendance = input.attendance ?? [];
  const userIds = new Set<number>([
    ...input.progress.map(row => row.userId),
    ...input.assignments.map(row => row.userId),
    ...input.homework.map(row => row.userId),
    ...input.attempts.filter(row => input.questionIds.has(row.questionId)).map(row => row.userId),
    ...attendance.map(row => row.userId),
  ]);
  const students = Array.from(userIds).map(userId => {
    const progress = input.progress.filter(row => row.userId === userId);
    const assignments = input.assignments.filter(row => row.userId === userId);
    const homework = input.homework.filter(row => row.userId === userId);
    const attempts = input.attempts.filter(row => row.userId === userId && input.questionIds.has(row.questionId));
    const studentAttendance = attendance.filter(row => row.userId === userId);
    const completedTasks = progress.filter(row => row.percent >= 100).length + assignments.filter(row => row.status !== "assigned").length;
    const overdueTasks = assignments.filter(row => row.status === "assigned" && row.dueDate !== null && row.dueDate.getTime() < now.getTime()).length;
    const openTasks = assignments.filter(row => row.status === "assigned").length + progress.filter(row => row.percent < 100).length;
    const accuracy = attempts.length ? Math.round(attempts.reduce((total, row) => total + (row.isCorrect ? 1 : 0), 0) / attempts.length * 100) : null;
    const presentSessions = studentAttendance.filter(row => row.status === "present" || row.status === "late").length;
    const absentSessions = studentAttendance.filter(row => row.status === "absent").length;
    const participationSeconds = studentAttendance.reduce((sum, row) => sum + row.joinDurationSeconds, 0);
    const engagementEvents = studentAttendance.reduce((sum, row) => sum + row.engagementEvents, 0);
    const submittedWorkCount = studentAttendance.reduce((sum, row) => sum + row.submittedWorkCount, 0);
    const participationRate = studentAttendance.length ? Math.round((presentSessions / studentAttendance.length) * 100) : null;
    const priorityCohort = progress.some(row => input.grade9LessonIds.has(row.lessonId)) || assignments.some(row => row.lessonId !== null && input.grade9LessonIds.has(row.lessonId)) || homework.some(row => row.lessonId !== null && input.grade9LessonIds.has(row.lessonId));
    const noActiveParticipation = presentSessions > 0 && engagementEvents === 0 && submittedWorkCount === 0;
    const noSubmittedWork = presentSessions > 0 && submittedWorkCount === 0;
    const lowEngagement = absentSessions > 0 || noActiveParticipation || noSubmittedWork || (participationRate !== null && participationRate < 70);
    const followUpType = absentSessions > 0 ? "missed_session" : noActiveParticipation ? "no_engagement" : noSubmittedWork ? "no_submission" : overdueTasks > 0 ? "overdue_work" : accuracy !== null && accuracy < 70 ? "low_accuracy" : participationRate !== null && participationRate < 70 ? "low_participation" : null;
    const learningContext = overdueTasks > 0 ? ` Also review ${overdueTasks} overdue task${overdueTasks === 1 ? "" : "s"}.` : accuracy !== null && accuracy < 70 ? ` Practice accuracy is ${accuracy}%; revisit incorrect steps.` : openTasks > 0 ? ` The student has ${openTasks} open task${openTasks === 1 ? "" : "s"}.` : "";
    const recommendation = followUpType === "missed_session" ? `Invite the student to review the missed interactive session.${learningContext}` : followUpType === "overdue_work" ? `Help the student make a short plan to clear overdue work.${learningContext}` : followUpType === "low_accuracy" ? `Offer a guided correction session before adding new work.${learningContext}` : followUpType === "no_engagement" ? `Check in and ask the student to complete a short recap.${learningContext}` : followUpType === "no_submission" ? `Ask the student to submit one worked example from the session.${learningContext}` : followUpType === "low_participation" ? `Offer a guided check-in and one focused practice task.${learningContext}` : null;
    const taskDraft = followUpType === "missed_session" ? `10-minute session recap · Review the recording or notes and answer two checkpoint questions.${learningContext}` : followUpType === "overdue_work" ? `Priority catch-up · Complete one overdue task and share the step that feels hardest.${learningContext}` : followUpType === "low_accuracy" ? `Correction practice · Rework two missed questions and explain the corrected method.${learningContext}` : followUpType === "no_engagement" ? `Quick participation reset · Submit one worked example and one question from the session.${learningContext}` : followUpType === "no_submission" ? `Session evidence · Submit one worked example and one question from the session.${learningContext}` : followUpType === "low_participation" ? `Focused practice · Complete three problems from the session topic and request help on one step.${learningContext}` : null;
    const nextAction = followUpType === "missed_session" ? "Review missed interactive session" : overdueTasks > 0 ? "Review overdue work with the student" : presentSessions > 0 && engagementEvents === 0 ? "Check in about interactive-session participation" : openTasks > 0 ? "Complete the next assigned task" : accuracy !== null && accuracy < 70 ? "Review incorrect practice and request support" : "Continue with the next lesson";
    return { userId, name: input.names.find(name => name.id === userId)?.name || "Unnamed student", completedTasks, openTasks, overdueTasks, homeworkSubmissions: homework.length, accuracy, priorityCohort, presentSessions, absentSessions, participationSeconds, engagementEvents, submittedWorkCount, participationRate, lowEngagement, followUpType, recommendation, taskDraft, nextAction };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const relevantAttempts = input.attempts.filter(row => input.questionIds.has(row.questionId));
  return {
    students,
    attendance: {
      sessions: new Set(attendance.map(row => `${row.sessionDate}:${row.sessionTitle}`)).size,
      records: attendance.length,
      present: attendance.filter(row => row.status === "present").length,
      late: attendance.filter(row => row.status === "late").length,
      absent: attendance.filter(row => row.status === "absent").length,
      excused: attendance.filter(row => row.status === "excused").length,
      engagementEvents: attendance.reduce((sum, row) => sum + row.engagementEvents, 0),
      submittedWorkCount: attendance.reduce((sum, row) => sum + row.submittedWorkCount, 0),
    },
    totals: {
      students: students.length,
      priorityStudents: students.filter(student => student.priorityCohort).length,
      completedTasks: students.reduce((sum, student) => sum + student.completedTasks, 0),
      openTasks: students.reduce((sum, student) => sum + student.openTasks, 0),
      overdueTasks: students.reduce((sum, student) => sum + student.overdueTasks, 0),
      homeworkSubmissions: students.reduce((sum, student) => sum + student.homeworkSubmissions, 0),
      accuracy: relevantAttempts.length ? Math.round(relevantAttempts.reduce((sum, row) => sum + (row.isCorrect ? 1 : 0), 0) / relevantAttempts.length * 100) : null,
      presentStudents: students.filter(student => student.presentSessions > 0).length,
      absentStudents: students.filter(student => student.absentSessions > 0).length,
      engagedStudents: students.filter(student => student.engagementEvents > 0).length,
    },
  };
}
