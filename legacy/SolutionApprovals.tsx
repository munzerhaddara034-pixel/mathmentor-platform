import {
  AlertTriangle,
  Check,
  FileText,
  PlayCircle,
  RotateCcw,
  Search,
  Send,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { aiSolutionDrafts } from "@shared/aiSolutionDrafts";
import { togglePageSelection, toggleSelectedId } from "@shared/bulkSelection";
import { paginateItems } from "@shared/pagination";

type SortMode = "newest" | "oldest" | "title";
type BulkAction = "approved" | "rejected";
type PagerCopy = {
  page: string;
  of: string;
  previous: string;
  next: string;
  pageSize: string;
};

function PaginationControls({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  copy,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  copy: PagerCopy;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e3e6df] bg-white p-3 text-sm">
      <label className="flex items-center gap-2">
        <span className="font-semibold text-[#536176]">{copy.pageSize}</span>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="rounded-lg border border-[#d9dcd4] bg-white px-2 py-1"
        >
          <option value={6}>6</option>
          <option value={12}>12</option>
          <option value={24}>24</option>
        </select>
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-full border border-[#d9dcd4] px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copy.previous}
        </button>
        <span className="font-semibold text-[#536176]">
          {copy.page} {page} {copy.of} {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-full border border-[#d9dcd4] px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copy.next}
        </button>
      </div>
    </div>
  );
}

const gradeFromModel = (modelId: string) => {
  const normalized = modelId.toLowerCase();
  if (normalized.includes("grade-9")) return "Grade 9";
  if (normalized.includes("sat")) return "SAT";
  if (normalized.includes("grade-12")) return "Grade 12";
  return "Other";
};

const modelFromRef = (ref: string) => ref.split("/")[0] || "Other";

export default function SolutionApprovals() {
  const [isArabic, setIsArabic] = useState(false);
  const [skill, setSkill] = useState("");
  const [questionRef, setQuestionRef] = useState("");
  const [videoScript, setVideoScript] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [printableSolution, setPrintableSolution] = useState("");
  const [queuedAiRefs, setQueuedAiRefs] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [pageSize, setPageSize] = useState(6);
  const [aiPage, setAiPage] = useState(1);
  const [queuePage, setQueuePage] = useState(1);
  const [selectedDraftIds, setSelectedDraftIds] = useState<number[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [bulkFeedback, setBulkFeedback] = useState("");

  const utils = trpc.useUtils();
  const queue = trpc.academy.solutionApprovalQueue.useQuery({ status: "awaiting_approval" });
  const createDraft = trpc.academy.createSolutionDraft.useMutation({
    onSuccess: () => {
      setSkill("");
      setQuestionRef("");
      setVideoScript("");
      setVideoUrl("");
      setPrintableSolution("");
      void utils.academy.solutionApprovalQueue.invalidate();
    },
  });
  const review = trpc.academy.reviewSolutionDraft.useMutation({
    onSuccess: (_result, variables) => {
      setSelectedDraftIds((current) => current.filter((id) => id !== variables.id));
      void utils.academy.solutionApprovalQueue.invalidate();
    },
  });
  const bulkReview = trpc.academy.reviewSolutionDrafts.useMutation({
    onSuccess: (_result, variables) => {
      setSelectedDraftIds([]);
      setBulkFeedback(
        isArabic
          ? `تم ${variables.status === "approved" ? "اعتماد" : "رفض"} ${variables.ids.length} مسودة.`
          : `${variables.ids.length} drafts were ${variables.status === "approved" ? "approved" : "rejected"}.`,
      );
      void utils.academy.solutionApprovalQueue.invalidate();
    },
    onError: () => {
      setBulkFeedback(
        isArabic
          ? "تعذر تنفيذ الإجراء الجماعي. لم تُغيَّر المسودات، يرجى المحاولة مجددًا."
          : "The bulk action could not be completed. No further action was taken; please try again.",
      );
    },
  });

  const copy = isArabic
    ? {
        title: "اعتماد شروحات الحل",
        intro: "لا يظهر أي شرح للطلاب قبل اعتماد الأستاذ منذر.",
        skill: "المهارة",
        ref: "مرجع السؤال",
        video: "مسودة نص الفيديو",
        videoUrl: "رابط فيديو اختياري",
        print: "حل مطبوع",
        create: "إرسال للمراجعة",
        empty: "لا توجد مسودات مطابقة للفلاتر.",
        approve: "اعتماد ونشر",
        changes: "طلب تعديل",
        reject: "رفض",
        language: "English",
        search: "بحث في السؤال أو المهارة",
        subject: "المادة / المهارة",
        grade: "الصف",
        all: "الكل",
        reset: "إعادة ضبط",
        sort: "الفرز",
        newest: "الأحدث",
        oldest: "الأقدم",
        titleSort: "حسب العنوان",
        results: "نتيجة مطابقة",
        page: "الصفحة",
        of: "من",
        previous: "السابق",
        next: "التالي",
        pageSize: "في الصفحة",
        awaiting: "بانتظار الموافقة",
        queue: "إضافة إلى قائمة الاعتماد",
        queued: "أُضيفت إلى قائمة الاعتماد",
        selectPage: "تحديد الصفحة الحالية",
        clearSelection: "مسح التحديد",
        selected: "مسودة محددة",
        bulkApprove: "اعتماد المحدد",
        bulkReject: "رفض المحدد",
        confirmApprove: "تأكيد الاعتماد الجماعي",
        confirmReject: "تأكيد الرفض الجماعي",
        cancel: "إلغاء",
        confirm: "تأكيد الإجراء",
        processing: "جارٍ التنفيذ...",
      }
    : {
        title: "Solution approval",
        intro: "No solution is visible to students until Professor Munzer approves it.",
        skill: "Skill",
        ref: "Question reference",
        video: "Video script draft",
        videoUrl: "Optional video URL",
        print: "Printable solution",
        create: "Submit for review",
        empty: "No drafts match these filters.",
        approve: "Approve and publish",
        changes: "Request changes",
        reject: "Reject",
        language: "العربية",
        search: "Search question or skill",
        subject: "Subject / skill",
        grade: "Grade",
        all: "All",
        reset: "Reset",
        sort: "Sort",
        newest: "Newest",
        oldest: "Oldest",
        titleSort: "By title",
        results: "matching results",
        page: "Page",
        of: "of",
        previous: "Previous",
        next: "Next",
        pageSize: "Per page",
        awaiting: "Awaiting approval",
        queue: "Queue for professor approval",
        queued: "Queued for approval",
        selectPage: "Select current page",
        clearSelection: "Clear selection",
        selected: "drafts selected",
        bulkApprove: "Approve selected",
        bulkReject: "Reject selected",
        confirmApprove: "Confirm bulk approval",
        confirmReject: "Confirm bulk rejection",
        cancel: "Cancel",
        confirm: "Confirm action",
        processing: "Processing...",
      };

  const aiSubjects = useMemo(
    () => Array.from(new Set(aiSolutionDrafts.map((draft) => draft.skill))).sort(),
    [],
  );
  const grades = ["Grade 9", "Grade 12", "SAT", "Other"];
  const matches = (subject: string, ref: string, modelId: string, language: string) => {
    const query = search.trim().toLowerCase();
    const haystack = `${subject} ${ref} ${modelId}`.toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (subjectFilter !== "all" && subject !== subjectFilter) return false;
    if (gradeFilter !== "all" && gradeFromModel(modelId) !== gradeFilter) return false;
    if (languageFilter !== "all" && language !== languageFilter) return false;
    return true;
  };

  const filteredAiDrafts = useMemo(() => {
    const visible = aiSolutionDrafts.filter((draft) =>
      matches(
        draft.skill,
        `${draft.model_id}/${draft.question_id}`,
        draft.model_id,
        languageFilter === "ar" ? "ar" : "en",
      ),
    );
    return [...visible].sort((a, b) =>
      sortMode === "title"
        ? `${a.skill}/${a.question_id}`.localeCompare(`${b.skill}/${b.question_id}`)
        : 0,
    );
  }, [gradeFilter, languageFilter, search, sortMode, subjectFilter]);

  const filteredQueue = useMemo(() => {
    const visible = (queue.data ?? []).filter((draft) =>
      matches(draft.skill, draft.questionRef, modelFromRef(draft.questionRef), draft.language),
    );
    return [...visible].sort((a, b) => {
      if (sortMode === "title") return a.questionRef.localeCompare(b.questionRef);
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sortMode === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [gradeFilter, languageFilter, queue.data, search, sortMode, subjectFilter]);

  const aiPagination = paginateItems(filteredAiDrafts, aiPage, pageSize);
  const queuePagination = paginateItems(filteredQueue, queuePage, pageSize);
  const { items: pagedAiDrafts, page: safeAiPage, totalPages: aiTotalPages } = aiPagination;
  const { items: pagedQueue, page: safeQueuePage, totalPages: queueTotalPages } = queuePagination;
  const currentQueuePageIds = pagedQueue.map((draft) => draft.id);
  const allCurrentPageSelected =
    currentQueuePageIds.length > 0 && currentQueuePageIds.every((id) => selectedDraftIds.includes(id));
  const visibleCount = filteredAiDrafts.length + filteredQueue.length;

  useEffect(() => {
    setAiPage(1);
    setQueuePage(1);
    setSelectedDraftIds([]);
  }, [search, subjectFilter, gradeFilter, languageFilter, sortMode, pageSize]);

  useEffect(() => {
    const availableIds = new Set((queue.data ?? []).map((draft) => draft.id));
    setSelectedDraftIds((current) => current.filter((id) => availableIds.has(id)));
  }, [queue.data]);

  const resetFilters = () => {
    setSearch("");
    setSubjectFilter("all");
    setGradeFilter("all");
    setLanguageFilter("all");
    setSortMode("newest");
    setPageSize(6);
    setAiPage(1);
    setQueuePage(1);
    setSelectedDraftIds([]);
  };

  const queueAiDraft = async (draft: (typeof aiSolutionDrafts)[number]) => {
    const ref = `${draft.model_id}/${draft.question_id}`;
    if (queuedAiRefs.includes(ref)) return;
    await Promise.all([
      createDraft.mutateAsync({
        skill: draft.skill,
        questionRef: ref,
        videoScript: `${draft.video_script_en}\n\nStoryboard:\n${JSON.stringify(draft.storyboard_en)}`,
        printableSolution: draft.printable_solution_en,
        language: "en",
      }),
      createDraft.mutateAsync({
        skill: draft.skill,
        questionRef: ref,
        videoScript: `${draft.video_script_ar}\n\nالمشاهد:\n${JSON.stringify(draft.storyboard_ar)}`,
        printableSolution: draft.printable_solution_ar,
        language: "ar",
      }),
    ]);
    setQueuedAiRefs((current) => [...current, ref]);
    void utils.academy.solutionApprovalQueue.invalidate();
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!skill || !questionRef || !videoScript || !printableSolution) return;
    createDraft.mutate({
      skill,
      questionRef,
      videoScript,
      videoUrl: videoUrl || undefined,
      printableSolution,
      language: isArabic ? "ar" : "en",
    });
  };

  const confirmBulkAction = () => {
    if (!bulkAction || selectedDraftIds.length === 0) return;
    setBulkFeedback(copy.processing);
    bulkReview.mutate({ ids: selectedDraftIds, status: bulkAction });
  };

  return (
    <main dir={isArabic ? "rtl" : "ltr"} className="min-h-screen bg-[#f7f7f4] px-4 py-8 text-[#15233b] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => setIsArabic((value) => !value)}
            className="rounded-full border border-[#d9dcd4] bg-white px-4 py-2 text-sm font-bold"
          >
            {copy.language}
          </button>
        </div>

        <header className="rounded-[2rem] bg-[#14233e] px-6 py-8 text-white shadow-xl sm:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#edbd5f]">Professor Munzer</p>
          <h1 className="mt-3 font-serif text-4xl sm:text-5xl">{copy.title}</h1>
          <p className="mt-3 max-w-2xl text-slate-300">{copy.intro}</p>
        </header>

        <form onSubmit={submit} className="mt-6 grid gap-4 rounded-3xl bg-white p-6 shadow-sm sm:grid-cols-2">
          <input value={skill} onChange={(event) => setSkill(event.target.value)} placeholder={copy.skill} className="rounded-xl border border-[#d9dcd4] px-4 py-3" />
          <input value={questionRef} onChange={(event) => setQuestionRef(event.target.value)} placeholder={copy.ref} className="rounded-xl border border-[#d9dcd4] px-4 py-3" />
          <textarea value={videoScript} onChange={(event) => setVideoScript(event.target.value)} placeholder={copy.video} className="min-h-32 rounded-xl border border-[#d9dcd4] px-4 py-3 sm:col-span-2" />
          <input value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} type="url" placeholder={copy.videoUrl} className="rounded-xl border border-[#d9dcd4] px-4 py-3 sm:col-span-2" />
          <textarea value={printableSolution} onChange={(event) => setPrintableSolution(event.target.value)} placeholder={copy.print} className="min-h-32 rounded-xl border border-[#d9dcd4] px-4 py-3 sm:col-span-2" />
          <button type="submit" disabled={createDraft.isPending} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#edbd5f] px-5 py-3 font-bold text-[#14233e] sm:col-span-2">
            <Send size={16} />
            {copy.create}
          </button>
        </form>

        <section className="mt-6 rounded-3xl border border-[#d9e1ed] bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-5">
            <label className="md:col-span-2">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#667085]">{copy.search}</span>
              <div className="flex items-center gap-2 rounded-xl border border-[#d9dcd4] px-3">
                <Search size={16} className="text-[#7b8798]" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 border-0 px-1 py-3 outline-none" placeholder={copy.search} />
              </div>
            </label>
            <label>
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#667085]">{copy.subject}</span>
              <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)} className="w-full rounded-xl border border-[#d9dcd4] bg-white px-3 py-3">
                <option value="all">{copy.all}</option>
                {aiSubjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#667085]">{copy.grade}</span>
              <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} className="w-full rounded-xl border border-[#d9dcd4] bg-white px-3 py-3">
                <option value="all">{copy.all}</option>
                {grades.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#667085]">{copy.sort}</span>
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="w-full rounded-xl border border-[#d9dcd4] bg-white px-3 py-3">
                <option value="newest">{copy.newest}</option>
                <option value="oldest">{copy.oldest}</option>
                <option value="title">{copy.titleSort}</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#536176]">{visibleCount} {copy.results}</p>
            <div className="flex flex-wrap gap-2">
              <select value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)} className="rounded-full border border-[#d9dcd4] bg-white px-3 py-2 text-sm">
                <option value="all">{copy.all} · Language</option>
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
              <button type="button" onClick={resetFilters} className="inline-flex items-center gap-2 rounded-full border border-[#d9dcd4] bg-white px-4 py-2 text-sm font-bold">
                <RotateCcw size={14} />
                {copy.reset}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-[#e7d7b4] bg-[#fffaf0] p-6 shadow-sm">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a06b19]">AI draft batch · 30 questions</p>
            <h2 className="mt-2 text-2xl font-bold">{isArabic ? "مسودات الذكاء الاصطناعي الجاهزة للمراجعة" : "Verified AI drafts ready for review"}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6a5a3b]">
              {isArabic
                ? "كل مسودة تحتوي على شرح مكتوب، ورقة حل، ونص ومشاهد فيديو. إدخالها هنا لا ينشرها؛ تبقى بانتظار موافقة الأستاذ."
                : "Each draft includes written guidance, a printable solution, and a video script/storyboard. Queueing it never publishes it; it remains awaiting professor approval."}
            </p>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {pagedAiDrafts.map((draft) => {
              const ref = `${draft.model_id}/${draft.question_id}`;
              const queued = queuedAiRefs.includes(ref);
              return (
                <article key={ref} className="rounded-2xl border border-[#eadfca] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[#b07820]">{draft.skill}</p>
                      <h3 className="mt-1 text-sm font-bold">{ref}</h3>
                    </div>
                    <span className="rounded-full bg-[#fff5df] px-2 py-1 text-[10px] font-bold text-[#8a611b]">{copy.awaiting}</span>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#536176]">{isArabic ? draft.written_explanation_ar : draft.written_explanation_en}</p>
                  <button type="button" disabled={queued || createDraft.isPending} onClick={() => void queueAiDraft(draft)} className="mt-4 w-full rounded-full bg-[#14233e] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                    {queued ? copy.queued : copy.queue}
                  </button>
                </article>
              );
            })}
          </div>
          {filteredAiDrafts.length ? (
            <PaginationControls page={safeAiPage} totalPages={aiTotalPages} pageSize={pageSize} onPageChange={setAiPage} onPageSizeChange={setPageSize} copy={copy} />
          ) : null}
        </section>

        <section className="mt-6 space-y-4">
          {filteredQueue.length ? (
            <>
              <div className="sticky top-3 z-20 rounded-2xl border border-[#cad6e4] bg-white/95 p-4 shadow-lg backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 font-bold">
                      <input
                        type="checkbox"
                        checked={allCurrentPageSelected}
                        onChange={() => setSelectedDraftIds((current) => togglePageSelection(current, currentQueuePageIds))}
                        className="size-4 accent-[#14233e]"
                      />
                      {copy.selectPage}
                    </label>
                    <span className="rounded-full bg-[#eef2f7] px-3 py-1 text-sm font-semibold text-[#536176]">
                      {selectedDraftIds.length} {copy.selected}
                    </span>
                    <button type="button" disabled={!selectedDraftIds.length} onClick={() => setSelectedDraftIds([])} className="text-sm font-bold text-[#667085] underline-offset-4 hover:underline disabled:opacity-40">
                      {copy.clearSelection}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!selectedDraftIds.length || bulkReview.isPending} onClick={() => { setBulkFeedback(""); setBulkAction("approved"); }} className="inline-flex items-center gap-2 rounded-full bg-[#3d6b4c] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
                      <Check size={15} />
                      {copy.bulkApprove}
                    </button>
                    <button type="button" disabled={!selectedDraftIds.length || bulkReview.isPending} onClick={() => { setBulkFeedback(""); setBulkAction("rejected"); }} className="inline-flex items-center gap-2 rounded-full border border-[#f0d1c9] bg-[#fff8f6] px-4 py-2 text-sm font-bold text-[#a65b4c] disabled:cursor-not-allowed disabled:opacity-40">
                      <X size={15} />
                      {copy.bulkReject}
                    </button>
                  </div>
                </div>
                {bulkFeedback ? <p role="status" className="mt-3 text-sm font-semibold text-[#536176]">{bulkFeedback}</p> : null}
              </div>

              {pagedQueue.map((draft) => {
                const selected = selectedDraftIds.includes(draft.id);
                return (
                  <article key={draft.id} className={`rounded-3xl border bg-white p-6 shadow-sm transition ${selected ? "border-[#3d6b4c] ring-2 ring-[#3d6b4c]/15" : "border-[#e3e6df]"}`}>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => setSelectedDraftIds((current) => toggleSelectedId(current, draft.id))}
                          aria-label={`${isArabic ? "تحديد" : "Select"} ${draft.questionRef}`}
                          className="mt-1 size-5 shrink-0 accent-[#14233e]"
                        />
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-[#b07820]">{draft.skill}</p>
                          <h2 className="mt-2 text-xl font-bold">{draft.questionRef}</h2>
                        </div>
                      </div>
                      <span className="rounded-full bg-[#fff5df] px-3 py-1 text-xs font-bold text-[#8a611b]">{draft.status}</span>
                    </div>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl bg-[#f7f9f5] p-4">
                        <div className="flex items-center gap-2 font-bold"><PlayCircle size={16} />{copy.video}</div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#536176]">{draft.videoScript}</p>
                      </div>
                      <div className="rounded-2xl bg-[#f7f9f5] p-4">
                        <div className="flex items-center gap-2 font-bold"><FileText size={16} />{copy.print}</div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#536176]">{draft.printableSolution}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" disabled={review.isPending || bulkReview.isPending} onClick={() => review.mutate({ id: draft.id, status: "approved" })} className="inline-flex items-center gap-2 rounded-full bg-[#3d6b4c] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
                        <Check size={15} />{copy.approve}
                      </button>
                      <button type="button" disabled={review.isPending || bulkReview.isPending} onClick={() => review.mutate({ id: draft.id, status: "changes_requested" })} className="inline-flex items-center gap-2 rounded-full border border-[#d7c497] bg-[#fff8e8] px-4 py-2 text-sm font-bold text-[#8a611b] disabled:opacity-40">
                        {copy.changes}
                      </button>
                      <button type="button" disabled={review.isPending || bulkReview.isPending} onClick={() => review.mutate({ id: draft.id, status: "rejected" })} className="inline-flex items-center gap-2 rounded-full border border-[#f0d1c9] bg-[#fff8f6] px-4 py-2 text-sm font-bold text-[#a65b4c] disabled:opacity-40">
                        <X size={15} />{copy.reject}
                      </button>
                    </div>
                  </article>
                );
              })}

              <PaginationControls page={safeQueuePage} totalPages={queueTotalPages} pageSize={pageSize} onPageChange={setQueuePage} onPageSizeChange={setPageSize} copy={copy} />
            </>
          ) : (
            <div className="rounded-3xl bg-white p-8 text-center text-[#657184]">{copy.empty}</div>
          )}
        </section>
      </div>

      <AlertDialog open={bulkAction !== null} onOpenChange={(open) => { if (!open) setBulkAction(null); }}>
        <AlertDialogContent dir={isArabic ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-[#fff5df] text-[#8a611b]">
              <AlertTriangle size={20} />
            </div>
            <AlertDialogTitle>{bulkAction === "approved" ? copy.confirmApprove : copy.confirmReject}</AlertDialogTitle>
            <AlertDialogDescription>
              {isArabic
                ? `سيتم ${bulkAction === "approved" ? "اعتماد ونشر" : "رفض"} ${selectedDraftIds.length} مسودة. لا يُنفذ الإجراء إلا بعد هذا التأكيد.`
                : `${selectedDraftIds.length} drafts will be ${bulkAction === "approved" ? "approved and published" : "rejected"}. The action only runs after this confirmation.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkReview.isPending}>{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction disabled={bulkReview.isPending} onClick={confirmBulkAction} className={bulkAction === "rejected" ? "bg-[#a65b4c] text-white hover:bg-[#914a3e]" : "bg-[#3d6b4c] text-white hover:bg-[#31563d]"}>
              {bulkReview.isPending ? copy.processing : copy.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
