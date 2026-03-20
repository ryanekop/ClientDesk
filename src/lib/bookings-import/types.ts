export type ImportIssueLevel = "error" | "warning";

export type ImportIssue = {
  level: ImportIssueLevel;
  message: string;
};

export type ImportSummary = {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
};

export type ImportReportFile = {
  fileName: string;
  base64: string;
};

export type ImportPreviewRow = {
  rowNumber: number;
  externalImportId: string;
  clientName: string;
  eventType: string;
  sessionDate: string | null;
  status: string;
  mainServices: string[];
  addonServices: string[];
  freelancers: string[];
  dpPaid: number;
  packageTotal: number;
  addonTotal: number;
  totalPrice: number;
  errors: string[];
  warnings: string[];
};

export type ImportCustomFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox";

export type ImportCustomFieldDefinition = {
  id: string;
  label: string;
  type: ImportCustomFieldType;
  required: boolean;
  options: string[];
  sectionId: "client_info" | "session_details" | "payment_details";
  sectionTitle: string;
};

export type ImportServiceRow = {
  id: string;
  name: string;
  price: number;
  isAddon: boolean;
  eventTypes: string[];
  sortOrder: number;
};

export type ImportFreelancerRow = {
  id: string;
  name: string;
};

export type ImportContext = {
  userId: string;
  statusOptions: string[];
  initialStatus: string;
  eventTypeOptions: string[];
  mainServices: ImportServiceRow[];
  addonServices: ImportServiceRow[];
  freelancers: ImportFreelancerRow[];
  customFieldsByEventType: Record<string, ImportCustomFieldDefinition[]>;
  customFieldUnion: ImportCustomFieldDefinition[];
  extraFieldUnion: Array<{
    key: string;
    label: string;
    required: boolean;
    isNumeric: boolean;
  }>;
};

export type NormalizedImportRow = {
  rowNumber: number;
  rawExternalImportId: string;
  externalImportId: string;
  clientName: string;
  eventType: string;
  status: string;
  sessionDate: string | null;
  bookingDate: string | null;
  mainServiceIds: string[];
  addonServiceIds: string[];
  freelancerIds: string[];
  mainServiceNames: string[];
  addonServiceNames: string[];
  freelancerNames: string[];
  dpPaid: number;
  packageTotal: number;
  addonTotal: number;
  totalPrice: number;
  accommodationFee: number;
  discountAmount: number;
  hasAccommodationFeeInput: boolean;
  hasDiscountAmountInput: boolean;
  location: string | null;
  locationDetail: string | null;
  notes: string | null;
  adminNotes: string | null;
  builtInExtraFields: Record<string, string>;
  customFieldSnapshots: Array<{
    id: string;
    label: string;
    type: ImportCustomFieldType;
    value: string;
    sectionId: "client_info" | "session_details" | "payment_details";
    sectionTitle: string;
  }>;
  issues: ImportIssue[];
};

export type ImportValidationResult = {
  summary: ImportSummary;
  canCommit: boolean;
  hasErrors: boolean;
  previewRows: ImportPreviewRow[];
  normalizedRows: NormalizedImportRow[];
  report: ImportReportFile;
};

export type ImportCommitRowResult = {
  rowNumber: number;
  externalImportId: string;
  bookingId?: string;
  bookingCode?: string;
  status: "created" | "failed";
  error?: string;
};

export type ImportCommitSummary = {
  totalRows: number;
  importedRows: number;
  failedRows: number;
};

export type ImportSyncSummary = {
  successCount: number;
  failedCount: number;
  skippedCount: number;
  errors: string[];
  skipped: string[];
};
