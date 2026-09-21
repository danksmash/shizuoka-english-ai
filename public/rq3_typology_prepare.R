# RQ3 類型分布分析：データ点検・記述統計準備テンプレート
# 2026-09-22
# このスクリプトは主モデルを自動実行しません。
# interaction_codes.csvをjamovi/GAMLjへ渡す前の再現可能な点検用です。

args <- commandArgs(trailingOnly = TRUE)
input_file <- if (length(args) >= 1) args[[1]] else "interaction_codes.csv"
output_dir <- if (length(args) >= 2) args[[2]] else "rq3_analysis_prepared"

if (!file.exists(input_file)) {
  stop(paste("入力ファイルが見つかりません:", input_file))
}

dir.create(output_dir, showWarnings = FALSE, recursive = TRUE)

d <- read.csv(
  input_file,
  stringsAsFactors = FALSE,
  check.names = FALSE,
  na.strings = c("", "NA")
)

required <- c(
  "interaction_schema_version",
  "run_id",
  "codebook_version",
  "participant_key",
  "school_condition",
  "session_id",
  "analysis_period",
  "reference_primary_raw",
  "reference_primary_model",
  "function_primary",
  "analysis_ready"
)

missing_cols <- setdiff(required, names(d))
if (length(missing_cols) > 0) {
  stop(paste("必須列が不足しています:", paste(missing_cols, collapse = ", ")))
}

ready <- d[d$analysis_ready == 1, , drop = FALSE]
if (nrow(ready) == 0) {
  stop("analysis_ready == 1 の行がありません。正式コード確定後に実行してください。")
}

if (any(is.na(ready$participant_key) | ready$participant_key == "")) {
  stop("participant_key が欠損した分析対象行があります。")
}

if (any(is.na(ready$reference_primary_model) | ready$reference_primary_model == "")) {
  stop("reference_primary_model が欠損した分析対象行があります。")
}

if (any(is.na(ready$function_primary) | ready$function_primary == "")) {
  stop("function_primary が欠損した分析対象行があります。")
}

ready$school_condition <- factor(
  ready$school_condition,
  levels = c("comparison", "intervention")
)
ready$analysis_period <- factor(
  ready$analysis_period,
  levels = c("period1", "period2", "period3")
)
ready$reference_primary_model <- factor(
  ready$reference_primary_model,
  levels = c("B0", "B1", "B2", "B3", "B4")
)
ready$function_primary <- factor(
  ready$function_primary,
  levels = c("RES", "ACK", "Q", "TOP", "COMP", "REP")
)

if (any(is.na(ready$school_condition))) {
  stop("school_condition に想定外の値があります。")
}
if (any(is.na(ready$analysis_period))) {
  stop("analysis_period に想定外の値があります。")
}
if (any(is.na(ready$reference_primary_model))) {
  stop("reference_primary_model に想定外の値があります。")
}
if (any(is.na(ready$function_primary))) {
  stop("function_primary に想定外の値があります。")
}

make_distribution <- function(data, outcome, all_levels) {
  base <- expand.grid(
    school_condition = levels(data$school_condition),
    analysis_period = levels(data$analysis_period),
    outcome = all_levels,
    stringsAsFactors = FALSE
  )

  counts <- as.data.frame(
    xtabs(
      as.formula(paste("~ school_condition + analysis_period +", outcome)),
      data = data,
      drop.unused.levels = FALSE
    )
  )
  names(counts) <- c("school_condition", "analysis_period", "outcome", "count")
  counts$school_condition <- as.character(counts$school_condition)
  counts$analysis_period <- as.character(counts$analysis_period)
  counts$outcome <- as.character(counts$outcome)

  out <- merge(
    base,
    counts,
    by = c("school_condition", "analysis_period", "outcome"),
    all.x = TRUE
  )
  out$count[is.na(out$count)] <- 0

  totals <- aggregate(
    count ~ school_condition + analysis_period,
    data = out,
    FUN = sum
  )
  names(totals)[names(totals) == "count"] <- "stratum_n"
  out <- merge(out, totals, by = c("school_condition", "analysis_period"), all.x = TRUE)
  out$percentage <- ifelse(out$stratum_n > 0, 100 * out$count / out$stratum_n, NA_real_)
  out$zero_cell <- out$count == 0
  out
}

reference_desc <- make_distribution(
  ready,
  "reference_primary_model",
  levels(ready$reference_primary_model)
)

function_desc <- make_distribution(
  ready,
  "function_primary",
  levels(ready$function_primary)
)

participant_desc <- aggregate(
  participant_key ~ school_condition + analysis_period,
  data = ready,
  FUN = function(x) length(unique(x))
)
names(participant_desc)[names(participant_desc) == "participant_key"] <- "participants"

sequence_desc <- aggregate(
  session_id ~ school_condition + analysis_period,
  data = ready,
  FUN = length
)
names(sequence_desc)[names(sequence_desc) == "session_id"] <- "sequences"

stratum_summary <- merge(
  participant_desc,
  sequence_desc,
  by = c("school_condition", "analysis_period"),
  all = TRUE
)

diagnostics <- rbind(
  transform(reference_desc, dimension = "reference"),
  transform(function_desc, dimension = "function")
)
diagnostics <- diagnostics[
  diagnostics$zero_cell | diagnostics$count < 5,
  c("dimension", "school_condition", "analysis_period", "outcome", "count", "stratum_n", "percentage", "zero_cell")
]

write.csv(
  ready,
  file.path(output_dir, "rq3_gamlj_ready.csv"),
  row.names = FALSE,
  na = ""
)
write.csv(
  reference_desc,
  file.path(output_dir, "rq3_reference_descriptive.csv"),
  row.names = FALSE,
  na = ""
)
write.csv(
  function_desc,
  file.path(output_dir, "rq3_function_descriptive.csv"),
  row.names = FALSE,
  na = ""
)
write.csv(
  stratum_summary,
  file.path(output_dir, "rq3_stratum_summary.csv"),
  row.names = FALSE,
  na = ""
)
write.csv(
  diagnostics,
  file.path(output_dir, "rq3_sparse_cell_diagnostics.csv"),
  row.names = FALSE,
  na = ""
)

cat("RQ3 analysis preparation complete.\n")
cat("Input rows:", nrow(d), "\n")
cat("analysis_ready rows:", nrow(ready), "\n")
cat("Participants:", length(unique(ready$participant_key)), "\n")
cat("Sparse/zero cell warnings:", nrow(diagnostics), "\n")
cat("Output:", normalizePath(output_dir), "\n")
