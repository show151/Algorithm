const state = {
  problems: [],
  filtered: [],
  activeId: null,
  viewMode: "browse",
  revealedAnswers: {},
  drafts: {},
  solveDrafts: {},
  mastery: {},
  solveTests: {},
  solveResults: {},
  pyodideReady: false,
  pyodideLoading: false,
};

const heroStats = document.getElementById("hero-stats");
const categorySelect = document.getElementById("category-select");
const difficultySelect = document.getElementById("difficulty-select");
const viewModeSelect = document.getElementById("view-mode-select");
const searchInput = document.getElementById("search-input");
const problemList = document.getElementById("problem-list");
const detailPanel = document.getElementById("detail-panel");
const problemCount = document.getElementById("problem-count");

const STORAGE_KEYS = {
  drafts: "algoboard-practice-drafts",
  solveDrafts: "algoboard-solve-drafts",
  mastery: "algoboard-practice-mastery",
};

const PYTHON_SUPPORT = `
import json

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def build_list(values):
    dummy = ListNode(0)
    node = dummy
    for value in values:
        node.next = ListNode(value)
        node = node.next
    return dummy.next

def build_cycle_list(values, pos):
    if not values:
        return None
    nodes = [ListNode(value) for value in values]
    for index in range(len(nodes) - 1):
        nodes[index].next = nodes[index + 1]
    if pos >= 0:
        nodes[-1].next = nodes[pos]
    return nodes[0]

def build_tree(values):
    if not values:
        return None
    nodes = [None if value is None else TreeNode(value) for value in values]
    kids = nodes[::-1]
    root = kids.pop()
    for node in nodes:
        if node is not None:
            if kids:
                node.left = kids.pop()
            if kids:
                node.right = kids.pop()
    return root

def serialize_list(head, limit=200):
    values = []
    seen = set()
    node = head
    steps = 0
    while node is not None and steps < limit:
        steps += 1
        if id(node) in seen:
            values.append("__cycle__")
            break
        seen.add(id(node))
        values.append(node.val)
        node = node.next
    return values

def serialize_tree(root):
    if not root:
        return []
    result = []
    queue = [root]
    while queue:
        node = queue.pop(0)
        if node is None:
            result.append(None)
            continue
        result.append(node.val)
        queue.append(node.left)
        queue.append(node.right)
    while result and result[-1] is None:
        result.pop()
    return result

def decode_arg(arg):
    if isinstance(arg, dict):
        arg_type = arg.get("__type")
        if arg_type == "listnode":
            return build_list(arg.get("values", []))
        if arg_type == "cycle_listnode":
            return build_cycle_list(arg.get("values", []), arg.get("pos", -1))
        if arg_type == "treenode":
            return build_tree(arg.get("values", []))
        return {key: decode_arg(value) for key, value in arg.items()}
    if isinstance(arg, list):
        return [decode_arg(value) for value in arg]
    return arg

def to_jsonable(value):
    if isinstance(value, ListNode):
        return {"__type": "listnode_result", "values": serialize_list(value)}
    if isinstance(value, TreeNode):
        return {"__type": "treenode_result", "values": serialize_tree(value)}
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, tuple):
        return [to_jsonable(item) for item in value]
    if isinstance(value, list):
        return [to_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {str(key): to_jsonable(val) for key, val in value.items()}
    return repr(value)

def run_solution(code, method_name, args_json):
    namespace = {}
    exec(code, namespace)
    if "Solution" not in namespace:
        raise ValueError("Solution class not found")
    solver = namespace["Solution"]()
    if not hasattr(solver, method_name):
        raise ValueError(f"Method not found: {method_name}")
    args = json.loads(args_json)
    decoded_args = [decode_arg(arg) for arg in args]
    result = getattr(solver, method_name)(*decoded_args)
    return to_jsonable(result)

def run_design(code, class_name, init_args_json, method_name, call_args_list_json):
    namespace = {}
    exec(code, namespace)
    if class_name not in namespace:
        raise ValueError(f"Class not found: {class_name}")
    init_args = json.loads(init_args_json)
    call_args_list = json.loads(call_args_list_json)
    decoded_init_args = [decode_arg(arg) for arg in init_args]
    instance = namespace[class_name](*decoded_init_args)
    outputs = []
    for args in call_args_list:
        decoded_args = [decode_arg(arg) for arg in args]
        outputs.append(to_jsonable(getattr(instance, method_name)(*decoded_args)))
    return outputs
`;

const TEST_SPECS = {
  "1": { kind: "two-sum", method: "twoSum", compare: "unordered-flat" },
  "2": { kind: "add-two-numbers", method: "addTwoNumbers", compare: "exact" },
  "3": { kind: "longest-substring", method: "lengthOfLongestSubstring", compare: "exact" },
  "20": { kind: "valid-parentheses", method: "isValid", compare: "exact" },
  "22": { kind: "generate-parentheses", method: "generateParenthesis", compare: "string-set" },
  "33": { kind: "rotated-search", method: "search", compare: "exact" },
  "35": { kind: "search-insert", method: "searchInsert", compare: "exact" },
  "39": { kind: "combination-sum", method: "combinationSum", compare: "nested-number-set" },
  "46": { kind: "permutations", method: "permute", compare: "nested-number-set" },
  "49": { kind: "group-anagrams", method: "groupAnagrams", compare: "grouped-strings" },
  "50": { kind: "pow", method: "myPow", compare: "float" },
  "53": { kind: "maximum-subarray", method: "maxSubArray", compare: "exact" },
  "62": { kind: "unique-paths", method: "uniquePaths", compare: "exact" },
  "63": { kind: "unique-paths-ii", method: "uniquePathsWithObstacles", compare: "exact" },
  "78": { kind: "subsets", method: "subsets", compare: "nested-number-set" },
  "82": { kind: "dedupe-list-ii", method: "deleteDuplicates", compare: "exact" },
  "83": { kind: "dedupe-list", method: "deleteDuplicates", compare: "exact" },
  "98": { kind: "validate-bst", method: "isValidBST", compare: "exact" },
  "102": { kind: "level-order", method: "levelOrder", compare: "exact" },
  "103": { kind: "zigzag-level-order", method: "zigzagLevelOrder", compare: "exact" },
  "104": { kind: "tree-depth-max", method: "maxDepth", compare: "exact" },
  "105": { kind: "build-tree", method: "buildTree", compare: "exact" },
  "108": { kind: "sorted-array-to-bst", method: "sortedArrayToBST", compare: "bst-valid" },
  "111": { kind: "tree-depth-min", method: "minDepth", compare: "exact" },
  "112": { kind: "path-sum", method: "hasPathSum", compare: "exact" },
  "121": { kind: "best-stock", method: "maxProfit", compare: "exact" },
  "122": { kind: "best-stock-ii", method: "maxProfit", compare: "exact" },
  "127": { kind: "word-ladder", method: "ladderLength", compare: "exact" },
  "139": { kind: "word-break", method: "wordBreak", compare: "exact" },
  "141": { kind: "has-cycle", method: "hasCycle", compare: "exact" },
  "142": { kind: "detect-cycle", method: "detectCycle", compare: "cycle-entry" },
  "153": { kind: "find-min-rotated", method: "findMin", compare: "exact" },
  "198": { kind: "house-robber", method: "rob", compare: "exact" },
  "200": { kind: "number-of-islands", method: "numIslands", compare: "exact" },
  "206": { kind: "reverse-list", method: "reverseList", compare: "exact" },
  "209": { kind: "min-subarray-len", method: "minSubArrayLen", compare: "exact" },
  "213": { kind: "house-robber", method: "rob", compare: "exact" },
  "300": { kind: "lis", method: "lengthOfLIS", compare: "exact" },
  "322": { kind: "coin-change", method: "coinChange", compare: "exact" },
  "347": { kind: "top-k-frequent", method: "topKFrequent", compare: "unordered-flat" },
  "349": { kind: "intersection", method: "intersection", compare: "unordered-flat" },
  "373": { kind: "k-smallest-pairs", method: "kSmallestPairs", compare: "nested-number-set" },
  "387": { kind: "first-unique", method: "firstUniqChar", compare: "exact" },
  "560": { kind: "subarray-sum-k", method: "subarraySum", compare: "exact" },
  "617": { kind: "merge-trees", method: "mergeTrees", compare: "exact" },
  "695": { kind: "max-area-island", method: "maxAreaOfIsland", compare: "exact" },
  "703": { kind: "kth-largest-stream", className: "KthLargest", method: "add", compare: "exact-design" },
  "779": { kind: "kth-grammar", method: "kthGrammar", compare: "exact" },
  "929": { kind: "unique-emails", method: "numUniqueEmails", compare: "exact" },
  "1011": { kind: "ship-within-days", method: "shipWithinDays", compare: "exact" },
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne(items) {
  return items[randomInt(0, items.length - 1)];
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function sampleDistinct(count, min, max) {
  const values = new Set();
  while (values.size < count) {
    values.add(randomInt(min, max));
  }
  return [...values];
}

function randomLowerString(length) {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  return Array.from({ length }, () => letters[randomInt(0, letters.length - 1)]).join("");
}

function makeRotatedArray(length) {
  const base = sampleDistinct(length, -20, 40).sort((a, b) => a - b);
  const pivot = randomInt(0, length - 1);
  return [...base.slice(pivot), ...base.slice(0, pivot)];
}

function makeGrid(rows, cols, generator) {
  return Array.from({ length: rows }, (_, rowIndex) =>
    Array.from({ length: cols }, (_, colIndex) => generator(rowIndex, colIndex)),
  );
}

function generateWordLadderCase() {
  const base = ["hot", "dot", "dog", "lot", "log", "cog"];
  const extras = ["hog", "cot", "cat", "dat", "lag", "lit", "hit"];
  const useReachable = Math.random() > 0.3;
  const wordList = shuffle([...base, ...extras]).slice(0, randomInt(6, 10));
  if (!wordList.includes("cog") && useReachable) {
    wordList.push("cog");
  }
  return { args: ["hit", useReachable ? "cog" : "zzz", wordList] };
}

function encodeList(values) {
  return { __type: "listnode", values };
}

function encodeCycleList(values, pos) {
  return { __type: "cycle_listnode", values, pos };
}

function encodeTree(values) {
  return { __type: "treenode", values };
}

function generateTestCase(problemId) {
  switch (TEST_SPECS[problemId]?.kind) {
    case "two-sum": {
      const length = randomInt(2, 8);
      const nums = Array.from({ length }, () => randomInt(-9, 15));
      const first = randomInt(0, length - 2);
      const second = randomInt(first + 1, length - 1);
      const target = nums[first] + nums[second];
      return { args: [nums, target] };
    }
    case "add-two-numbers":
      return {
        args: [
          encodeList(Array.from({ length: randomInt(1, 5) }, () => randomInt(0, 9))),
          encodeList(Array.from({ length: randomInt(1, 5) }, () => randomInt(0, 9))),
        ],
      };
    case "longest-substring":
      return { args: [randomLowerString(randomInt(0, 10))] };
    case "valid-parentheses": {
      const chars = ["(", ")", "[", "]", "{", "}"];
      return { args: [Array.from({ length: randomInt(1, 12) }, () => pickOne(chars)).join("")] };
    }
    case "generate-parentheses":
      return { args: [randomInt(1, 5)] };
    case "rotated-search": {
      const nums = makeRotatedArray(randomInt(1, 8));
      const target = Math.random() > 0.35 ? pickOne(nums) : randomInt(-25, 45);
      return { args: [nums, target] };
    }
    case "search-insert": {
      const nums = sampleDistinct(randomInt(1, 8), -20, 20).sort((a, b) => a - b);
      return { args: [nums, randomInt(-25, 25)] };
    }
    case "combination-sum": {
      const candidates = sampleDistinct(randomInt(2, 5), 2, 9).sort((a, b) => a - b);
      return { args: [candidates, randomInt(4, 20)] };
    }
    case "permutations":
    case "subsets":
      return { args: [sampleDistinct(randomInt(1, 5), -4, 8)] };
    case "group-anagrams": {
      const seeds = ["eat", "tea", "ate", "tan", "nat", "bat", "tab", "abc", "cab"];
      return { args: [shuffle(seeds).slice(0, randomInt(3, 7))] };
    }
    case "pow":
      return { args: [randomInt(-4, 4) + Math.random(), randomInt(-8, 8)] };
    case "maximum-subarray":
    case "house-robber":
      return { args: [Array.from({ length: randomInt(1, 10) }, () => randomInt(-8, 12))] };
    case "unique-paths":
      return { args: [randomInt(1, 7), randomInt(1, 7)] };
    case "unique-paths-ii": {
      const rows = randomInt(2, 5);
      const cols = randomInt(2, 5);
      const grid = makeGrid(rows, cols, (row, col) => {
        if ((row === 0 && col === 0) || (row === rows - 1 && col === cols - 1)) {
          return 0;
        }
        return Math.random() > 0.7 ? 1 : 0;
      });
      return { args: [grid] };
    }
    case "best-stock":
      return { args: [Array.from({ length: randomInt(2, 10) }, () => randomInt(1, 20))] };
    case "best-stock-ii":
      return { args: [Array.from({ length: randomInt(2, 10) }, () => randomInt(1, 20))] };
    case "word-ladder":
      return generateWordLadderCase();
    case "word-break": {
      const pieces = ["leet", "code", "apple", "pen", "sand", "and", "cat", "dog"];
      const dictionary = shuffle(pieces).slice(0, randomInt(3, 6));
      const positive = Math.random() > 0.4;
      const s = positive
        ? Array.from({ length: randomInt(1, 3) }, () => pickOne(dictionary)).join("")
        : `${randomLowerString(3)}${randomLowerString(2)}`;
      return { args: [s, dictionary] };
    }
    case "find-min-rotated":
      return { args: [makeRotatedArray(randomInt(1, 8))] };
    case "dedupe-list":
    case "dedupe-list-ii": {
      const base = Array.from({ length: randomInt(1, 8) }, () => randomInt(1, 5)).sort((a, b) => a - b);
      return { args: [encodeList(base)] };
    }
    case "validate-bst": {
      const values = Math.random() > 0.4 ? [2, 1, 3] : [5, 1, 4, null, null, 3, 6];
      return { args: [encodeTree(values)] };
    }
    case "level-order":
    case "zigzag-level-order":
    case "tree-depth-max":
    case "tree-depth-min":
    case "path-sum": {
      const values = pickOne([
        [3, 9, 20, null, null, 15, 7],
        [1],
        [1, 2, 3, 4, null, null, 5],
        [5, 4, 8, 11, null, 13, 4, 7, 2, null, null, null, 1],
      ]);
      if (TEST_SPECS[problemId].kind === "path-sum") {
        return { args: [encodeTree(values), pickOne([22, 26, 18, 5])] };
      }
      return { args: [encodeTree(values)] };
    }
    case "build-tree": {
      const picked = pickOne([
        { preorder: [3, 9, 20, 15, 7], inorder: [9, 3, 15, 20, 7] },
        { preorder: [1, 2, 4, 5, 3], inorder: [4, 2, 5, 1, 3] },
      ]);
      return { args: [picked.preorder, picked.inorder] };
    }
    case "sorted-array-to-bst":
      return { args: [sampleDistinct(randomInt(1, 7), -10, 10).sort((a, b) => a - b)] };
    case "number-of-islands":
    case "max-area-island": {
      const rows = randomInt(2, 5);
      const cols = randomInt(2, 5);
      const grid = makeGrid(rows, cols, () => (Math.random() > 0.5 ? "1" : "0"));
      if (TEST_SPECS[problemId].kind === "max-area-island") {
        return { args: [grid.map((row) => row.map((value) => Number(value)))] };
      }
      return { args: [grid] };
    }
    case "has-cycle": {
      const values = sampleDistinct(randomInt(2, 7), 1, 20);
      const pos = Math.random() > 0.4 ? randomInt(0, values.length - 1) : -1;
      return { args: [encodeCycleList(values, pos)] };
    }
    case "detect-cycle": {
      const values = sampleDistinct(randomInt(2, 7), 1, 20);
      const pos = Math.random() > 0.2 ? randomInt(0, values.length - 1) : -1;
      return { args: [encodeCycleList(values, pos)] };
    }
    case "reverse-list":
      return { args: [encodeList(Array.from({ length: randomInt(1, 8) }, () => randomInt(-3, 9)))] };
    case "min-subarray-len":
      return {
        args: [randomInt(5, 25), Array.from({ length: randomInt(3, 10) }, () => randomInt(1, 10))],
      };
    case "lis":
      return { args: [Array.from({ length: randomInt(1, 10) }, () => randomInt(-10, 20))] };
    case "coin-change": {
      const coins = sampleDistinct(randomInt(1, 4), 1, 8).sort((a, b) => a - b);
      return { args: [coins, randomInt(0, 24)] };
    }
    case "top-k-frequent": {
      const nums = Array.from({ length: randomInt(4, 12) }, () => randomInt(1, 6));
      const unique = new Set(nums).size;
      return { args: [nums, randomInt(1, unique)] };
    }
    case "intersection":
      return {
        args: [
          Array.from({ length: randomInt(3, 8) }, () => randomInt(0, 9)),
          Array.from({ length: randomInt(3, 8) }, () => randomInt(0, 9)),
        ],
      };
    case "k-smallest-pairs": {
      const nums1 = Array.from({ length: randomInt(1, 4) }, () => randomInt(-3, 8)).sort((a, b) => a - b);
      const nums2 = Array.from({ length: randomInt(1, 4) }, () => randomInt(-3, 8)).sort((a, b) => a - b);
      return { args: [nums1, nums2, randomInt(1, nums1.length * nums2.length)] };
    }
    case "first-unique":
      return { args: [randomLowerString(randomInt(1, 10))] };
    case "subarray-sum-k":
      return {
        args: [
          Array.from({ length: randomInt(1, 8) }, () => randomInt(-4, 5)),
          randomInt(-5, 8),
        ],
      };
    case "kth-grammar": {
      const n = randomInt(1, 10);
      return { args: [n, randomInt(1, 2 ** (n - 1))] };
    }
    case "merge-trees": {
      const [left, right] = pickOne([
        [[1, 3, 2, 5], [2, 1, 3, null, 4, null, 7]],
        [[1], [1, 2]],
      ]);
      return { args: [encodeTree(left), encodeTree(right)] };
    }
    case "kth-largest-stream": {
      const nums = Array.from({ length: randomInt(0, 6) }, () => randomInt(-5, 12));
      const k = randomInt(1, Math.max(1, nums.length + 1));
      const calls = Array.from({ length: 20 }, () => [randomInt(-5, 12)]);
      return { args: [{ init: [k, nums], calls }] };
    }
    case "unique-emails": {
      const names = ["alice", "bob", "carol", "dave", "eva", "mike"];
      const emails = Array.from({ length: randomInt(3, 7) }, () => {
        const local = pickOne(names);
        const maybeDot = Math.random() > 0.5 ? `${local[0]}.${local.slice(1)}` : local;
        const maybePlus = Math.random() > 0.5 ? `${maybeDot}+tag${randomInt(1, 3)}` : maybeDot;
        return `${maybePlus}@leetcode.com`;
      });
      return { args: [emails] };
    }
    case "ship-within-days":
      return {
        args: [
          Array.from({ length: randomInt(3, 8) }, () => randomInt(1, 10)),
          randomInt(1, 5),
        ],
      };
    default:
      return null;
  }
}

function generateTwentyTests(problemId) {
  const cases = [];
  for (let index = 0; index < 20; index += 1) {
    const testCase = generateTestCase(problemId);
    if (!testCase) {
      return [];
    }
    cases.push({ id: index + 1, ...testCase });
  }
  return cases;
}

function extractMethodName(code, fallback) {
  const match = code.match(/class\s+Solution[\s\S]*?\n\s+def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
  return match?.[1] || fallback;
}

function normalizeForCompare(compareKind, value) {
  if (compareKind === "cycle-entry") {
    if (value && typeof value === "object" && value.__type === "listnode_result") {
      return value.values[0] ?? null;
    }
    return value;
  }

  if (compareKind === "float") {
    return Number(value);
  }

  if (compareKind === "unordered-flat") {
    return [...value].sort((a, b) => `${a}`.localeCompare(`${b}`));
  }

  if (compareKind === "nested-number-set") {
    return [...value]
      .map((entry) => [...entry].sort((a, b) => a - b))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }

  if (compareKind === "grouped-strings") {
    return [...value]
      .map((group) => [...group].sort())
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }

  if (compareKind === "string-set") {
    return [...value].sort();
  }

  return value;
}

function outputsMatch(compareKind, userValue, referenceValue) {
  if (compareKind === "bst-valid") {
    const values = userValue?.values || [];
    const inorder = [];
    const walk = (index) => {
      if (index >= values.length || values[index] === null || values[index] === undefined) {
        return;
      }
      walk(index * 2 + 1);
      inorder.push(values[index]);
      walk(index * 2 + 2);
    };
    walk(0);
    const height = (index) => {
      if (index >= values.length || values[index] === null || values[index] === undefined) {
        return 0;
      }
      const left = height(index * 2 + 1);
      const right = height(index * 2 + 2);
      if (left === -1 || right === -1 || Math.abs(left - right) > 1) {
        return -1;
      }
      return Math.max(left, right) + 1;
    };
    const sorted = [...inorder].sort((a, b) => a - b);
    const expected = [...(referenceValue?.values || [])].filter((value) => value !== null).sort((a, b) => a - b);
    return JSON.stringify(inorder) === JSON.stringify(sorted) && JSON.stringify(sorted) === JSON.stringify(expected) && height(0) !== -1;
  }

  if (compareKind === "float") {
    return Math.abs(Number(userValue) - Number(referenceValue)) < 1e-6;
  }

  return JSON.stringify(normalizeForCompare(compareKind, userValue)) === JSON.stringify(normalizeForCompare(compareKind, referenceValue));
}

async function ensurePyodideReady() {
  if (state.pyodideReady) {
    return window.pyodide;
  }

  if (state.pyodideLoading) {
    while (!state.pyodideReady) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return window.pyodide;
  }

  state.pyodideLoading = true;
  const pyodide = await window.loadPyodide({ indexURL: `${window.location.origin}/vendor/pyodide/` });
  await pyodide.runPythonAsync(PYTHON_SUPPORT);
  state.pyodideReady = true;
  state.pyodideLoading = false;
  return pyodide;
}

async function executePythonSolution(code, methodName, args) {
  const pyodide = await ensurePyodideReady();
  pyodide.globals.set("current_code", code);
  pyodide.globals.set("current_method_name", methodName);
  pyodide.globals.set("current_args_json", JSON.stringify(args));
  const result = await pyodide.runPythonAsync("run_solution(current_code, current_method_name, current_args_json)");
  return result.toJs ? result.toJs({ dict_converter: Object.fromEntries }) : result;
}

async function executePythonDesign(code, className, methodName, initArgs, callArgsList) {
  const pyodide = await ensurePyodideReady();
  pyodide.globals.set("current_code", code);
  pyodide.globals.set("current_class_name", className);
  pyodide.globals.set("current_method_name", methodName);
  pyodide.globals.set("current_init_args_json", JSON.stringify(initArgs));
  pyodide.globals.set("current_call_args_list_json", JSON.stringify(callArgsList));
  const result = await pyodide.runPythonAsync(
    "run_design(current_code, current_class_name, current_init_args_json, current_method_name, current_call_args_list_json)",
  );
  return result.toJs ? result.toJs({ dict_converter: Object.fromEntries }) : result;
}

function renderTestPreview(problemId) {
  const tests = state.solveTests[problemId] || [];
  if (!tests.length) {
    return `<p class="detail-notes">まだテストはありません。20件まとめて自動生成できます。</p>`;
  }

  return `
    <div class="test-grid">
      ${tests.slice(0, 5).map((test) => `<div class="test-chip">#${test.id} ${escapeHtml(JSON.stringify(test.args))}</div>`).join("")}
    </div>
    <p class="detail-notes">${tests.length}件生成済みです。</p>
  `;
}

function renderSolveResults(problemId) {
  const result = state.solveResults[problemId];
  if (!result) {
    return `<p class="detail-notes">まだ実行していません。</p>`;
  }

  return `
    <div class="test-summary ${result.failed === 0 ? "test-summary-pass" : "test-summary-fail"}">
      <strong>${result.passed}/${result.total} passed</strong>
      <span>${escapeHtml(result.message)}</span>
    </div>
    ${
      result.failures.length
        ? `<div class="test-failures">
            ${result.failures.map((failure) => `
              <div class="test-failure-card">
                <strong>Test #${failure.id}</strong>
                <p>Input: <code>${escapeHtml(JSON.stringify(failure.args))}</code></p>
                <p>Your output: <code>${escapeHtml(JSON.stringify(failure.userOutput))}</code></p>
                <p>Expected: <code>${escapeHtml(JSON.stringify(failure.referenceOutput))}</code></p>
              </div>
            `).join("")}
          </div>`
        : ""
    }
  `;
}

function difficultyClass(value) {
  return `difficulty-${value.toLowerCase()}`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalizeDisplayText(value) {
  return value.replaceAll("\\n", "\n");
}

function loadStoredState() {
  try {
    state.drafts = JSON.parse(localStorage.getItem(STORAGE_KEYS.drafts) || "{}");
    state.solveDrafts = JSON.parse(localStorage.getItem(STORAGE_KEYS.solveDrafts) || "{}");
    state.mastery = JSON.parse(localStorage.getItem(STORAGE_KEYS.mastery) || "{}");
  } catch {
    state.drafts = {};
    state.solveDrafts = {};
    state.mastery = {};
  }
}

function persistDrafts() {
  localStorage.setItem(STORAGE_KEYS.drafts, JSON.stringify(state.drafts));
}

function persistSolveDrafts() {
  localStorage.setItem(STORAGE_KEYS.solveDrafts, JSON.stringify(state.solveDrafts));
}

function persistMastery() {
  localStorage.setItem(STORAGE_KEYS.mastery, JSON.stringify(state.mastery));
}

function lineCount(value) {
  if (!value.trim()) {
    return 0;
  }
  return value.split(/\r?\n/).length;
}

function leadingWhitespace(value) {
  const match = value.match(/^\s*/);
  return match ? match[0] : "";
}

function extractVisibleScaffold(solution) {
  const lines = solution.split(/\r?\n/);
  const visible = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (visible.length && visible[visible.length - 1] !== "") {
        visible.push("");
      }
      continue;
    }

    if (trimmed.startsWith("class ")) {
      visible.push(line);
      continue;
    }

    if (trimmed.startsWith("def ")) {
      visible.push(line);
      continue;
    }

    if (trimmed.startsWith("async def ")) {
      visible.push(line);
      continue;
    }

    if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
      break;
    }
  }

  return visible.join("\n").trimEnd();
}

function starterTemplate(problem) {
  const scaffold = extractVisibleScaffold(problem.solution);
  if (scaffold) {
    return `${scaffold}\n\n`;
  }
  return `# ${problem.id} ${problem.title}\n# まずは関数名・引数・返り値を思い出して書く\n\n`;
}

function solveTemplate(problem) {
  const scaffold = extractVisibleScaffold(problem.solution);
  if (scaffold) {
    return `${scaffold}\n    pass\n`;
  }
  return "";
}

function extractMethodSignatures(solution) {
  return solution
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("def ") || line.startsWith("async def "));
}

function hasSolvePrompt(problem) {
  return Boolean(problem.statement || problem.examples.length || problem.constraints.length);
}

function inferredStatement(problem) {
  const signatures = extractMethodSignatures(problem.solution);
  const signatureText = signatures.length
    ? `Target signature: ${signatures.join(" / ")}`
    : "Use the saved solution file as a reference for the expected function signature.";

  return [
    `${problem.title} を自力で解くモードです。`,
    `問題番号 #${problem.id}、カテゴリは ${problem.category}、主なタグは ${problem.tags.join(", ")} です。`,
    signatureText,
    "まずは入出力の形を整理して、制約を想定しながら最適なアルゴリズムを組み立ててください。",
  ].join("\n");
}

function inferredExamples(problem) {
  const signatures = extractMethodSignatures(problem.solution);
  if (!signatures.length) {
    return [
      "Input と Output を自分で仮定して、まず小さいケースを2つ作ってから実装してみましょう。",
    ];
  }

  return [
    `${signatures[0]}\nまずはこの関数シグネチャに合わせて、代表ケースを自分で 2〜3 個作って確認します。`,
  ];
}

function inferredConstraints(problem) {
  return [
    `カテゴリ: ${problem.category}`,
    `タグ: ${problem.tags.join(", ")}`,
    "まずは愚直解を考え、そのあと時間計算量と空間計算量を改善できるか確認します。",
  ];
}

function masteryLabel(problemId) {
  const status = state.mastery[problemId] || "unseen";
  const labels = {
    unseen: "未着手",
    shaky: "あやしい",
    memorized: "書けた",
  };
  return labels[status];
}

function masteryClass(problemId) {
  return `mastery-${state.mastery[problemId] || "unseen"}`;
}

function currentProblem() {
  return state.filtered.find((problem) => problem.id === state.activeId);
}

function renderStats(summary, categoryCounts) {
  const memorizedCount = Object.values(state.mastery).filter((value) => value === "memorized").length;
  const cards = [
    { label: "Problems", value: summary.problemCount },
    { label: "Categories", value: summary.categoryCount },
    { label: "Remembered", value: memorizedCount },
    { label: "Language", value: summary.language },
  ];

  heroStats.innerHTML = cards
    .map(
      (card) => `
        <div class="stat-card">
          <strong>${card.value}</strong>
          <span>${card.label}</span>
        </div>
      `,
    )
    .join("");
}

function populateCategories(categoryCounts) {
  Object.keys(categoryCounts).forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });
}

function applyFilters() {
  const keyword = searchInput.value.trim().toLowerCase();
  const category = categorySelect.value;
  const difficulty = difficultySelect.value;

  state.filtered = state.problems.filter((problem) => {
    const matchesKeyword =
      !keyword ||
      problem.id.includes(keyword) ||
      problem.title.toLowerCase().includes(keyword) ||
      problem.tags.join(" ").toLowerCase().includes(keyword);
    const matchesCategory = category === "all" || problem.category === category;
    const matchesDifficulty = difficulty === "all" || problem.difficulty === difficulty;

    return matchesKeyword && matchesCategory && matchesDifficulty;
  });

  renderProblemList();

  if (!state.filtered.some((problem) => problem.id === state.activeId)) {
    state.activeId = state.filtered[0]?.id ?? null;
  }

  renderDetail();
}

function jumpToRandomProblem() {
  if (!state.filtered.length) {
    return;
  }
  const randomIndex = Math.floor(Math.random() * state.filtered.length);
  state.activeId = state.filtered[randomIndex].id;
  renderProblemList();
  renderDetail();
}

function renderProblemList() {
  problemCount.textContent = `${state.filtered.length} problems`;

  if (!state.filtered.length) {
    problemList.innerHTML = `
      <div class="problem-card">
        <h3>該当する問題がありません</h3>
        <p class="problem-path">検索条件を変えてみてください。</p>
      </div>
    `;
    return;
  }

  problemList.innerHTML = state.filtered
    .map(
      (problem) => `
        <button class="problem-card ${problem.id === state.activeId ? "active" : ""}" data-problem-id="${problem.id}">
          <div class="problem-card-header">
            <div>
              <div class="problem-id">#${problem.id}</div>
              <h3>${problem.title}</h3>
            </div>
            <span class="badge ${difficultyClass(problem.difficulty)}">${problem.difficulty}</span>
          </div>
          <div class="badge-row">
            <span class="badge">${problem.category}</span>
            <span class="badge">${problem.language}</span>
            <span class="badge ${masteryClass(problem.id)}">${masteryLabel(problem.id)}</span>
          </div>
          <div class="tag-row">
            ${problem.tags.slice(0, 3).map((tag) => `<span class="tag">${tag}</span>`).join("")}
          </div>
        </button>
      `,
    )
    .join("");

  problemList.querySelectorAll("[data-problem-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeId = button.dataset.problemId;
      renderProblemList();
      renderDetail();
    });
  });
}

function renderDetail() {
  const activeProblem = currentProblem();

  if (!activeProblem) {
    detailPanel.innerHTML = `
      <div class="empty-state">
        <p class="empty-kicker">No Match</p>
        <h2>表示できる問題がありません</h2>
        <p>検索条件を変更すると、ここに問題詳細が表示されます。</p>
      </div>
    `;
    return;
  }

  detailPanel.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="eyebrow">Problem #${activeProblem.id}</p>
        <h2>${activeProblem.title}</h2>
        <p class="detail-meta">${activeProblem.category} · ${activeProblem.language} · ${activeProblem.path}</p>
      </div>
      <div class="detail-header-actions">
        ${activeProblem.sourceUrl ? `<a class="link-button" href="${activeProblem.sourceUrl}" target="_blank" rel="noreferrer">Open LeetCode</a>` : ""}
        <span class="badge ${difficultyClass(activeProblem.difficulty)}">${activeProblem.difficulty}</span>
      </div>
    </div>

    <section class="detail-section">
      <h3>Tags</h3>
      <div class="tag-row">
        ${activeProblem.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
      </div>
    </section>

    <section class="detail-section">
      <h3>Notes</h3>
      <p class="detail-notes">${activeProblem.notes || "必要なら problems_meta.json にメモを追記できます。"}</p>
    </section>
    ${
      state.viewMode === "practice"
        ? renderPracticePanel(activeProblem)
        : state.viewMode === "solve"
          ? renderSolvePanel(activeProblem)
          : renderBrowsePanel(activeProblem)
    }
  `;

  bindDetailEvents(activeProblem);
}

function renderBrowsePanel(problem) {
  return `
    <section class="detail-section">
      <h3>Solution</h3>
      <pre><code>${escapeHtml(problem.solution)}</code></pre>
    </section>
  `;
}

function renderPracticePanel(problem) {
  const revealed = Boolean(state.revealedAnswers[problem.id]);
  const draft = state.drafts[problem.id] || starterTemplate(problem);
  const solutionLines = lineCount(problem.solution);
  const draftLines = lineCount(draft);

  return `
    <section class="detail-section practice-panel">
      <div class="practice-header">
        <div>
          <h3>Practice</h3>
          <p class="detail-notes">答えを見ずに書いてから、最後にだけ正解を開く練習用モードです。</p>
        </div>
        <div class="practice-actions">
          <button class="action-button" data-action="random-problem">Random</button>
          <button class="action-button accent-button" data-action="toggle-answer">
            ${revealed ? "答えを隠す" : "答えを見る"}
          </button>
        </div>
      </div>

      <div class="practice-stack">
        <section class="practice-card">
          <div class="practice-card-head">
            <strong>自分で書く</strong>
            <span>${draftLines} lines</span>
          </div>
          <p class="detail-notes practice-hint"><code>class</code> と <code>def</code> だけ見える状態から、中身を手で埋める練習です。</p>
          <div class="editor-meta">
            <span>Python</span>
            <span>Tab: indent</span>
            <span>Shift+Tab: outdent</span>
          </div>
          <div class="editor-shell">
            <div id="practice-line-numbers" class="line-numbers" aria-hidden="true">${renderLineNumbers(draftLines)}</div>
            <textarea id="practice-editor" class="practice-editor" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off">${escapeHtml(draft)}</textarea>
          </div>
          <div class="practice-actions practice-actions-bottom">
            <button class="action-button" data-action="insert-template">テンプレを入れる</button>
            <button class="action-button" data-action="clear-draft">下書きを消す</button>
          </div>
        </section>

        <section class="practice-card">
          <div class="practice-card-head">
            <strong>正解コード</strong>
            <span>${solutionLines} lines</span>
          </div>
          ${
            revealed
              ? `<pre><code>${escapeHtml(problem.solution)}</code></pre>`
              : `<div class="answer-hidden">
                  <p>まだ非表示です。先に上のエディタで最後まで書いてみましょう。</p>
                  <p>書けたら「答えを見る」で下に正解を表示できます。</p>
                </div>`
          }
        </section>
      </div>

      <section class="detail-section practice-review">
        <h3>Self Check</h3>
        <p class="detail-notes">答えを見たあと、自分の状態を記録して次回の復習に使えます。</p>
        <div class="practice-actions">
          <button class="action-button mastery-button ${state.mastery[problem.id] === "shaky" ? "active" : ""}" data-action="mark-mastery" data-value="shaky">あやしい</button>
          <button class="action-button mastery-button ${state.mastery[problem.id] === "memorized" ? "active" : ""}" data-action="mark-mastery" data-value="memorized">書けた</button>
          <button class="action-button mastery-button ${state.mastery[problem.id] === "unseen" || !state.mastery[problem.id] ? "active" : ""}" data-action="mark-mastery" data-value="unseen">未着手に戻す</button>
        </div>
      </section>
    </section>
  `;
}

function renderExamples(problem) {
  const examples = problem.examples.length ? problem.examples : inferredExamples(problem);

  return examples
    .map(
      (example, index) => `
        <div class="prompt-card">
          <strong>Example ${index + 1}</strong>
          <pre><code>${escapeHtml(normalizeDisplayText(example))}</code></pre>
        </div>
      `,
    )
    .join("");
}

function renderConstraints(problem) {
  const constraints = problem.constraints.length ? problem.constraints : inferredConstraints(problem);

  return `
    <ul class="constraint-list">
      ${constraints.map((constraint) => `<li>${escapeHtml(constraint)}</li>`).join("")}
    </ul>
  `;
}

function renderSolvePanel(problem) {
  const revealed = Boolean(state.revealedAnswers[problem.id]);
  const draft = state.solveDrafts[problem.id] || solveTemplate(problem);
  const draftLines = lineCount(draft);
  const statementText = problem.statement ? normalizeDisplayText(problem.statement) : inferredStatement(problem);
  const statement = problem.statementHtml
    ? `<div class="leetcode-statement">${problem.statementHtml}</div>`
    : `<p class="detail-notes">${escapeHtml(statementText).replaceAll("\n", "<br />")}</p>`;
  const showDerivedSections = !problem.statementHtml;

  return `
    <section class="detail-section solve-panel">
      <div class="practice-header">
        <div>
          <h3>Solve</h3>
          <p class="detail-notes">
            問題文を見ながら、上から下へ流れる形で本番のつもりで解くモードです。
            ${hasSolvePrompt(problem) ? "" : "この問題は自動生成プロンプトで解けるようにしています。"}
          </p>
        </div>
        <div class="practice-actions">
          <button class="action-button" data-action="random-problem">Random</button>
          <button class="action-button accent-button" data-action="toggle-answer">
            ${revealed ? "解答を隠す" : "解答を見る"}
          </button>
        </div>
      </div>

      <section class="detail-section">
        <h3>Problem</h3>
        ${statement}
      </section>

      ${
        showDerivedSections
          ? `
      <section class="detail-section">
        <h3>Examples</h3>
        <div class="prompt-grid">
          ${renderExamples(problem)}
        </div>
      </section>

      <section class="detail-section">
        <h3>Constraints</h3>
        ${renderConstraints(problem)}
      </section>
      `
          : ""
      }

      <section class="detail-section practice-card">
        <div class="practice-card-head">
          <strong>解答を書く</strong>
          <span>${draftLines} lines</span>
        </div>
        <div class="editor-meta">
          <span>Python</span>
          <span>Tab: indent</span>
          <span>Shift+Tab: outdent</span>
        </div>
        <div class="editor-shell">
          <div id="solve-line-numbers" class="line-numbers" aria-hidden="true">${renderLineNumbers(draftLines)}</div>
          <textarea id="solve-editor" class="practice-editor" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off">${escapeHtml(draft)}</textarea>
        </div>
        <div class="practice-actions practice-actions-bottom">
          <button class="action-button" data-action="insert-solve-template">シグネチャを入れる</button>
          <button class="action-button" data-action="clear-solve-draft">解答を消す</button>
        </div>
      </section>

      <section class="detail-section practice-card">
        <div class="practice-card-head">
          <strong>Auto Tests</strong>
          <span>${TEST_SPECS[problem.id] ? "20 cases" : "unsupported"}</span>
        </div>
        ${
          TEST_SPECS[problem.id]
            ? `
        <p class="detail-notes">20件のランダムケースを作り、あなたの解答と保存済み正解を同じ条件で比較します。</p>
        <div class="practice-actions">
          <button class="action-button" data-action="generate-tests">20件作る</button>
          <button class="action-button accent-button" data-action="run-tests">答え合わせ</button>
        </div>
        <div class="test-preview">${renderTestPreview(problem.id)}</div>
        <div class="test-results">${renderSolveResults(problem.id)}</div>
        `
            : `<p class="detail-notes">この初期版では、この問題の自動テスト生成にはまだ対応していません。</p>`
        }
      </section>

      <section class="detail-section practice-card">
        <div class="practice-card-head">
          <strong>参考解答</strong>
          <span>${lineCount(problem.solution)} lines</span>
        </div>
        ${
          revealed
            ? `<pre><code>${escapeHtml(problem.solution)}</code></pre>`
            : `<div class="answer-hidden">
                <p>まずは自分で解き切ってから、最後に参考解答を確認しましょう。</p>
                <p>必要なときだけ「解答を見る」で開けます。</p>
              </div>`
        }
      </section>
    </section>
  `;
}

function renderLineNumbers(totalLines) {
  return Array.from({ length: Math.max(totalLines, 1) }, (_, index) => `<span>${index + 1}</span>`).join("");
}

function updateEditorLineNumbers(editor, gutter) {
  if (!editor || !gutter) {
    return;
  }
  gutter.innerHTML = renderLineNumbers(lineCount(editor.value));
  gutter.scrollTop = editor.scrollTop;
}

function replaceSelection(editor, replacement, selectionStart, selectionEnd) {
  editor.setRangeText(replacement, selectionStart, selectionEnd, "end");
}

function indentSelectedLines(editor, outdent = false) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const value = editor.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEndIndex = value.indexOf("\n", end);
  const safeLineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const selectedBlock = value.slice(lineStart, safeLineEnd);
  const lines = selectedBlock.split("\n");

  const updatedLines = lines.map((line) => {
    if (!outdent) {
      return `    ${line}`;
    }
    if (line.startsWith("    ")) {
      return line.slice(4);
    }
    if (line.startsWith("\t")) {
      return line.slice(1);
    }
    return line.replace(/^ {1,3}/, "");
  });

  const replacement = updatedLines.join("\n");
  editor.setSelectionRange(lineStart, safeLineEnd);
  replaceSelection(editor, replacement, lineStart, safeLineEnd);

  const updatedEnd = lineStart + replacement.length;
  const updatedStart = outdent ? Math.max(lineStart, start - 4) : start + 4;
  editor.setSelectionRange(updatedStart, updatedEnd);
}

function handleEditorKeydown(event) {
  const editor = event.target;

  if (event.key === "Tab") {
    event.preventDefault();

    if (editor.selectionStart !== editor.selectionEnd) {
      indentSelectedLines(editor, event.shiftKey);
    } else if (event.shiftKey) {
      const lineStart = editor.value.lastIndexOf("\n", editor.selectionStart - 1) + 1;
      const currentLine = editor.value.slice(lineStart, editor.selectionStart);
      const removable = currentLine.startsWith("    ")
        ? 4
        : currentLine.startsWith("\t")
          ? 1
          : (currentLine.match(/^ {1,3}/) || [""])[0].length;

      if (removable > 0) {
        replaceSelection(editor, "", lineStart, lineStart + removable);
        const nextPosition = Math.max(lineStart, editor.selectionStart - removable);
        editor.setSelectionRange(nextPosition, nextPosition);
      }
    } else {
      replaceSelection(editor, "    ", editor.selectionStart, editor.selectionEnd);
    }

    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  if (event.key === "Enter") {
    event.preventDefault();
    const start = editor.selectionStart;
    const lineStart = editor.value.lastIndexOf("\n", start - 1) + 1;
    const currentLine = editor.value.slice(lineStart, start);
    const indent = leadingWhitespace(currentLine);
    const shouldIncreaseIndent = /:\s*$/.test(currentLine.trimEnd());
    const nextIndent = shouldIncreaseIndent ? `${indent}    ` : indent;

    replaceSelection(editor, `\n${nextIndent}`, editor.selectionStart, editor.selectionEnd);
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function bindDetailEvents(problem) {
  const practiceEditor = document.getElementById("practice-editor");
  const practiceLineNumbers = document.getElementById("practice-line-numbers");
  const solveEditor = document.getElementById("solve-editor");
  const solveLineNumbers = document.getElementById("solve-line-numbers");

  if (practiceEditor) {
    practiceEditor.addEventListener("input", (event) => {
      state.drafts[problem.id] = event.target.value;
      persistDrafts();
      updateEditorLineNumbers(practiceEditor, practiceLineNumbers);
    });
    practiceEditor.addEventListener("scroll", () => {
      updateEditorLineNumbers(practiceEditor, practiceLineNumbers);
    });
    practiceEditor.addEventListener("keydown", handleEditorKeydown);
    updateEditorLineNumbers(practiceEditor, practiceLineNumbers);
  }

  if (solveEditor) {
    solveEditor.addEventListener("input", (event) => {
      state.solveDrafts[problem.id] = event.target.value;
      persistSolveDrafts();
      updateEditorLineNumbers(solveEditor, solveLineNumbers);
    });
    solveEditor.addEventListener("scroll", () => {
      updateEditorLineNumbers(solveEditor, solveLineNumbers);
    });
    solveEditor.addEventListener("keydown", handleEditorKeydown);
    updateEditorLineNumbers(solveEditor, solveLineNumbers);
  }

  detailPanel.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", async () => {
      const { action, value } = element.dataset;

      if (action === "toggle-answer") {
        state.revealedAnswers[problem.id] = !state.revealedAnswers[problem.id];
        renderDetail();
      }

      if (action === "random-problem") {
        jumpToRandomProblem();
      }

      if (action === "insert-template") {
        state.drafts[problem.id] = starterTemplate(problem);
        persistDrafts();
        renderDetail();
      }

      if (action === "clear-draft") {
        state.drafts[problem.id] = "";
        persistDrafts();
        renderDetail();
      }

      if (action === "insert-solve-template") {
        state.solveDrafts[problem.id] = solveTemplate(problem);
        persistSolveDrafts();
        renderDetail();
      }

      if (action === "clear-solve-draft") {
        state.solveDrafts[problem.id] = "";
        persistSolveDrafts();
        renderDetail();
      }

      if (action === "generate-tests") {
        state.solveTests[problem.id] = generateTwentyTests(problem.id);
        state.solveResults[problem.id] = null;
        renderDetail();
      }

      if (action === "run-tests") {
        const spec = TEST_SPECS[problem.id];
        if (!spec) {
          return;
        }

        const tests = state.solveTests[problem.id]?.length ? state.solveTests[problem.id] : generateTwentyTests(problem.id);
        state.solveTests[problem.id] = tests;
        state.solveResults[problem.id] = {
          total: tests.length,
          passed: 0,
          failed: 0,
          failures: [],
          message: "Running tests...",
        };
        renderDetail();

        try {
          const userCode = state.solveDrafts[problem.id] || solveTemplate(problem);
          const referenceMethod = extractMethodName(problem.solution, spec.method);
          const userMethod = extractMethodName(userCode, spec.method);
          const failures = [];
          let passed = 0;

          for (const test of tests) {
            let userOutput;
            let referenceOutput;

            if (spec.kind === "kth-largest-stream") {
              const payload = test.args[0];
              [userOutput, referenceOutput] = await Promise.all([
                executePythonDesign(userCode, spec.className, spec.method, structuredClone(payload.init), structuredClone(payload.calls)),
                executePythonDesign(problem.solution, spec.className, spec.method, structuredClone(payload.init), structuredClone(payload.calls)),
              ]);
            } else {
              [userOutput, referenceOutput] = await Promise.all([
                executePythonSolution(userCode, userMethod, structuredClone(test.args)),
                executePythonSolution(problem.solution, referenceMethod, structuredClone(test.args)),
              ]);
            }

            if (outputsMatch(spec.compare, userOutput, referenceOutput)) {
              passed += 1;
            } else if (failures.length < 5) {
              failures.push({
                id: test.id,
                args: test.args,
                userOutput,
                referenceOutput,
              });
            }
          }

          state.solveResults[problem.id] = {
            total: tests.length,
            passed,
            failed: tests.length - passed,
            failures,
            message: tests.length === passed ? "All tests passed." : "Some generated cases did not match the reference solution.",
          };
        } catch (error) {
          state.solveResults[problem.id] = {
            total: tests.length,
            passed: 0,
            failed: tests.length,
            failures: [],
            message: String(error.message || error),
          };
        }

        renderDetail();
      }

      if (action === "mark-mastery" && value) {
        state.mastery[problem.id] = value;
        persistMastery();
        renderStats(
          { problemCount: state.problems.length, categoryCount: new Set(state.problems.map((item) => item.category)).size, language: "Python" },
          state.problems.reduce((acc, item) => {
            acc[item.category] = (acc[item.category] || 0) + 1;
            return acc;
          }, {}),
        );
        renderProblemList();
        renderDetail();
      }
    });
  });
}

async function init() {
  const response = await fetch("./data/problems.json");
  const payload = await response.json();

  loadStoredState();
  state.problems = payload.problems;
  state.filtered = payload.problems;
  state.activeId = payload.problems[0]?.id ?? null;

  renderStats(payload.summary, payload.categoryCounts);
  populateCategories(payload.categoryCounts);
  renderProblemList();
  renderDetail();

  searchInput.addEventListener("input", applyFilters);
  categorySelect.addEventListener("change", applyFilters);
  difficultySelect.addEventListener("change", applyFilters);
  viewModeSelect.addEventListener("change", (event) => {
    state.viewMode = event.target.value;
    renderDetail();
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}

init().catch(() => {
  detailPanel.innerHTML = `
    <div class="empty-state">
      <p class="empty-kicker">Setup</p>
      <h2>データを読み込めませんでした</h2>
      <p><code>python generate_site.py</code> を実行してから、HTTP サーバー経由で開いてください。</p>
    </div>
  `;
});
