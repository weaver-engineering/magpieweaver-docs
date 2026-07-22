# Task ${ref} - ${title} 

**Companion to:** `task-${ref}.md`
**Governs phases:** `test`, `build`
**Gate model:** Architecture Definition Document, Guard Rails §1/§2 — Test
phase may only touch the test package; Build phase may only touch
implementation code. New tests must fail against the pre-implementation
codebase and pass, unmodified, after implementation (fail-then-pass rule).

## 1. Interface Under Test
-- document the interface to be implemented here. -- 

## 2. Deliverable
-- describe what is to be delivered by the spec here. --

### 2.1 Deliverable Notes For Agent
-- add nodes for the implementing agent here. --

## 3. Required Behaviors
* -- bullet points of the high level behaviors of the system here --

The following sections define the specific conditions and behaviors of the system under those conditions.
Each section defines:
* Given - A bullet list of the entry conditions of the behavior
* Either
  * When & Then - When is the action invoking the behavior. Then is a bullet list of expected outcomes of the behavior.
  * One or more sub sections also with Given and (When & Then) or more sub sections.
* The nested sections, each with a `* Given` bullet list define cumulative conditions.

### 3.1 Delete Files

#### 3.1.1 Delete Existing Files
* Given
  * A file exists at /test/dummy.txt

##### 3.1.1.1 Delete Existing Write Protected File
* Given
  * The condition of §3.1.1
  * /test/dummy.txt is not writable
* When - delete file
* Then -
  * A message states "/test/dummy.txt is not writable"
  * the value 1 is returned

##### 3.1.1.2 Delete Existing Non-Write Protected File
* Given
  * The condition of §3.1.1
  * /test/dummy.txt is writable
* When - delete file
* Then -
  * A message states "/test/dummy.txt was deleted OK"
  * /test/dummy.txt is deleted
  * the value 0 is returned

### 3.1.2 Delete Non-Existing File
* Given
  * A non file exists at /test/dummy.txt
* When - delete file
* Then -
  * A message states "/test/dummy.txt does not exist"
  * the value 1 is returned