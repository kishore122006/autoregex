# autoregex
Project Title
AutoRegex: Visual DFA/NFA Simulator & Regular Expression Engine
Problem Statement:

Traditional theoretical computer science instruction relies on manual, paper-based tracing of Deterministic and Non-Deterministic Finite Automata (DFA/NFA) and Regular Expressions. Students frequently struggle with debugging transition logic, tracking \epsilon-closures, handling trap/dead states, and understanding why a specific input string fails.
Existing desktop tools (like JFLAP) require legacy Java runtimes, lack modern browser accessibility, and offer unintuitive user interfaces. AutoRegex solves this by providing a lightweight, responsive, web-based simulation sandbox that parses automata definitions, renders interactive state graphs, and provides real-time, step-by-step visual feedback for string evaluation. 

Automata Definition & Table Builder
Dynamic Transition Table: Users select states Q = \{q_0, q_1, \dots\}, alphabet \Sigma = \{0, 1\} or \{a, b\}, designate the start state q_0, and toggle accepting/final states F (double ring).
Matrix Input: Clean HTML table where users fill in \delta(q, a) mappings.
Pre-loaded Presets: Dropdown with textbook problems (e.g., "Strings ending with '01'", "Strings with even number of 'a's", "Valid binary multiples of 3").
Interactive Graph Visualizer
Displays circles for states and curved directed arrows for transitions.
Self-loops for inputs that remain in the same state.
Start state marked with an incoming arrow; accepting states marked with a concentric double circle.
Step-by-Step String Execution Engine
The user inputs a test string (e.g., 100101).
Playback Controls: "Next Step", "Reset", and "Run All".
As each character is processed:
The current state circle lights up.

How to run:
Open index.html in a browser
the current read index.
Verdict Banner: Clear display indicating whether the string reached a final state (Accepted) or ended in a non-final/trap state (Rejected).
