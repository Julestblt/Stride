# Skills and domain capabilities

Skills are reusable, bounded capabilities. They remain separate from agents: a specialist may use several skills, and a skill may be used by more than one specialist. Skills should declare required context, validation, deterministic logic, output shape, and data access needs.

Potential domains include athlete profile, history, and zones; Garmin daily health, activities, and sync; training load and readiness; workout analysis and generation; weekly plan generation and adjustment; critical speed and heart-rate drift; race prediction and fitness trends; GPX analysis and course segmentation; race strategy and roadbooks.

These names are a planning vocabulary only. Add a skill when a real issue defines its behavior and tests, not as an empty placeholder.

The [coaching engine RFC](coaching-engine/README.md) (#86, proposed) separates calculable capabilities, implemented as tested domain modules in `src/features`, from prompt modules that a workflow loads for a specific task such as plan design, session adjustment, weekly review or explanation.
