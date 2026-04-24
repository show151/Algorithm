const state = {
  problems: [],
  filtered: [],
  activeId: null,
  viewMode: "browse",
  fundamentalsTopicIndex: 0,
  revealedAnswers: {},
  drafts: {},
  solveDrafts: {},
  mastery: {},
  solveTests: {},
  solveResults: {},
  pyodideReady: false,
  pyodideLoading: false,
  cacheStatus: "",
};

const heroStats = document.getElementById("hero-stats");
const categorySelect = document.getElementById("category-select");
const difficultySelect = document.getElementById("difficulty-select");
const viewModeSelect = document.getElementById("view-mode-select");
const searchInput = document.getElementById("search-input");
const problemList = document.getElementById("problem-list");
const detailPanel = document.getElementById("detail-panel");
const problemCount = document.getElementById("problem-count");
const clearCacheButton = document.getElementById("clear-cache-button");
const cacheStatus = document.getElementById("cache-status");
const clearCacheModal = document.getElementById("clear-cache-modal");
const clearCacheCancel = document.getElementById("clear-cache-cancel");
const clearCacheConfirm = document.getElementById("clear-cache-confirm");

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

const PROBLEM_HINTS = {
  "1": [
    "各要素 num に対して『target - num を先に見たか』だけ確認します。",
    "値をキー、添字を値にした hash map を1本持てば1回走査で書けます。",
  ],
  "2": [
    "桁ごとの足し算を linked list で再現すると考えると整理しやすいです。",
    "carry を持ちながら dummy head から新しいリストを伸ばします。",
  ],
  "3": [
    "重複がない区間を常に保つ、という条件を窓で管理します。",
    "右を広げて重複したら、重複が消えるまで左を縮めます。",
  ],
  "20": [
    "閉じ括弧を見たときに、直前の未処理の開き括弧と対応しているかを見ます。",
    "stack に開き括弧を積み、閉じ括弧で照合するだけです。",
  ],
  "22": [
    "文字列を1文字ずつ作る再帰として考えると書きやすいです。",
    "open と close の残数、または使った数を持ち、close は open を超えないようにします。",
  ],
  "33": [
    "回転していても、mid を境にどちらか片方は必ず単調増加です。",
    "どちらが整列済みかを判定して、その側に target が入るかで探索範囲を絞ります。",
  ],
  "35": [
    "見つからない場合でも『最初に入る位置』を返す lower_bound の問題として見ます。",
    "二分探索の終了時に left がそのまま答えになります。",
  ],
  "39": [
    "候補を何回使ってよいので、同じ index にとどまる再帰を許します。",
    "合計が target を超えたら止め、ちょうどなら現在の組み合わせを記録します。",
  ],
  "46": [
    "未使用の数字を1つずつ置いていく全探索です。",
    "path の長さが nums と同じになったら1通り完成です。",
  ],
  "49": [
    "anagram はソート後の文字列が同じになります。",
    "sorted(word) をキーにしてリストへ集約するだけで書けます。",
  ],
  "50": [
    "n が大きいので 1 回ずつ掛けるのではなく、指数を半分にします。",
    "x^n = (x^(n//2))^2 を使い、奇数のときだけ x を1回余分に掛けます。",
  ],
  "53": [
    "今の位置で終わる最大和だけ追うとシンプルです。",
    "前の和がマイナスなら捨てて、今の値から始め直します。",
  ],
  "62": [
    "各マスへの行き方は上と左から来る数の和です。",
    "dp[r][c] = dp[r-1][c] + dp[r][c-1] を埋めれば書けます。",
  ],
  "63": [
    "Unique Paths と同じですが、障害物マスは 0 通りにします。",
    "最初の行・列の初期化で障害物以降を 0 にする点だけ注意します。",
  ],
  "78": [
    "各要素について『入れる / 入れない』の2択を再帰で回します。",
    "または path を記録しながら、次に選ぶ位置を forward に進める形でも書けます。",
  ],
  "82": [
    "重複値を全部消すので、前後のつなぎ替えがしやすい dummy node を置きます。",
    "同じ値の連続区間を見つけたら、その区間ごと skip します。",
  ],
  "83": [
    "重複を1個残せばよいので、隣同士を比べて同じなら next を飛ばします。",
    "今見ている node と node.next の比較だけで進められます。",
  ],
  "98": [
    "BST 条件は各ノード単体ではなく、その部分木全体に対する上限下限で見ます。",
    "再帰で (low, high) を渡して、その範囲内か確認します。",
  ],
  "102": [
    "level ごとにまとめたいので BFS が自然です。",
    "queue の現在サイズ分だけ取り出して1レベルの配列を作ります。",
  ],
  "103": [
    "102 と同じく BFS で level ごとに集め、奇数レベルだけ reverse します。",
    "または deque に左右どちらから積むかを切り替えても書けます。",
  ],
  "104": [
    "各ノードで『左の深さ』『右の深さ』を取り、1 を足して返します。",
    "空ノードを 0 とすれば再帰がきれいです。",
  ],
  "105": [
    "preorder の先頭が根、inorder でその位置を探すと左右部分木に分かれます。",
    "inorder の index map を先に作ると毎回の探索が速くなります。",
  ],
  "108": [
    "高さバランスを作るには、常に中央を根に置きます。",
    "中央を root にして左右半分を再帰すればそのまま書けます。",
  ],
  "111": [
    "min depth は片側が空のとき min をそのまま取ると壊れます。",
    "子が片方しかない場合は、存在する側の深さだけを使います。",
  ],
  "112": [
    "根から葉までの累積和として見ます。",
    "leaf に着いたときに残り sum と node.val が一致するかを確認します。",
  ],
  "121": [
    "売る日を固定したとき、必要なのはそれ以前の最安値だけです。",
    "走査しながら min price を更新し、現在価格との差で最大利益を取ります。",
  ],
  "122": [
    "何回でも売買できるなら、上がった分を全部足してよいかを考えます。",
    "prices[i] > prices[i-1] の差分を足す greedy で書けます。",
  ],
  "127": [
    "最短変換回数なので BFS です。",
    "1文字ずつ変えた次状態を作り、未訪問語だけ queue に入れます。",
  ],
  "139": [
    "s[:i] が作れるか、という prefix DP で考えると整理しやすいです。",
    "dp[i] = どこかの j で dp[j] が真かつ s[j:i] が辞書にある、で更新します。",
  ],
  "141": [
    "cycle の有無だけなら fast/slow pointer の衝突を見るのが定番です。",
    "fast が 2 歩、slow が 1 歩で進み、ぶつかれば cycle ありです。",
  ],
  "142": [
    "まず fast/slow で cycle 内の衝突点を見つけます。",
    "その後 slow を head に戻して両方 1 歩ずつ進めると入口で会います。",
  ],
  "153": [
    "最小値は回転点にあるので、右端と mid を比べるとどちら側にあるか分かります。",
    "mid <= right なら左側に最小が含まれます。",
  ],
  "198": [
    "各家で『取る / 取らない』の2択ですが、必要なのは直前2状態だけです。",
    "dp[i] = max(dp[i-1], dp[i-2] + nums[i]) で進みます。",
  ],
  "200": [
    "島を見つけたら、その島全体を DFS/BFS で塗りつぶして数えます。",
    "訪問済みにしたマスは二度数えないようにします。",
  ],
  "206": [
    "1本ずつ矢印を逆向きに付け替えるイメージです。",
    "prev, curr, next の3本を持つと実装しやすいです。",
  ],
  "209": [
    "正の数だけなので、区間和が target を超えたら左を縮めても単調です。",
    "sum >= target の間に最短長を更新して左を進めます。",
  ],
  "213": [
    "円なので 1 件目と最終件目を同時には取れません。",
    "『先頭を含まない区間』『末尾を含まない区間』の House Robber を2回解きます。",
  ],
  "300": [
    "まずは dp[i] = i で終わる LIS 長 を考えると本質が見えます。",
    "その後余力があれば tails 配列の二分探索解に進めます。",
  ],
  "322": [
    "金額 x を作る最小枚数を DP で積み上げます。",
    "dp[amount] = min(dp[amount], dp[amount-coin] + 1) の形です。",
  ],
  "347": [
    "頻度が必要なのでまず count map、その後 top k を取り出します。",
    "heap を使うか、bucket sort 的に頻度ごとに集めても書けます。",
  ],
  "349": [
    "重複なしの共通部分なので set に落とすと一気に簡単になります。",
    "set(nums1) と set(nums2) の積集合で考えます。",
  ],
  "373": [
    "全組み合わせは多すぎるので、最小和の候補だけ heap に積みます。",
    "各 nums1[i] に対して最初の nums2[0] だけ入れ、次の j を増やしていきます。",
  ],
  "387": [
    "各文字の出現回数を数えてから、文字列を先頭から見直します。",
    "最初に count == 1 の文字の index が答えです。",
  ],
  "560": [
    "prefix sum を使うと、sum[i] - sum[j] = k を探す問題になります。",
    "過去の prefix sum の出現回数を hash map に持つのがポイントです。",
  ],
  "617": [
    "両方の木を同時に DFS して、同位置ノードをマージします。",
    "片方が null ならもう片方をそのまま返すと再帰が簡単です。",
  ],
  "695": [
    "1 の連結成分ごとに DFS/BFS して、その面積を数えます。",
    "1マス訪れるたびに +1 し、最大値だけ保持します。",
  ],
  "703": [
    "必要なのは常に上位 k 個だけなので、min-heap を k サイズで維持します。",
    "新しい値を入れてサイズが k を超えたら最小を捨て、heap[0] を返します。",
  ],
  "779": [
    "親子関係で考えると、k 番目は親のどちら側の子かで決まります。",
    "半分より前後で分ける再帰、または bit count の考え方で整理できます。",
  ],
  "929": [
    "local name の正規化ルールをそのまま実装します。",
    "'.' を消し、'+' 以降を捨ててから domain を付け直し、set に入れます。",
  ],
  "1011": [
    "容量 capacity を決めたときに days 以内で運べるかは判定できます。",
    "『判定できる最小値』なので、capacity を二分探索します。",
  ],
};

const FUNDAMENTALS_TRACK = [
  {
    title: "Array / String",
    focus: "基本操作と走査の文法",
    points: [
      "list の append / pop / slice など、まずは配列操作の型を覚える。",
      "文字列は immutable なので、繰り返し連結より join を使う。",
    ],
    orders: [
      { operation: "arr[i] 参照", time: "O(1)", space: "O(1)" },
      { operation: "append / pop (末尾)", time: "O(1)", space: "O(1)" },
      { operation: "insert(0, x) / pop(0)", time: "O(n)", space: "O(1)" },
      { operation: "''.join(parts)", time: "O(n)", space: "O(n)" },
    ],
    template: `# Array / String の基本文法\ndef array_string_basics(arr, s):\n    first = arr[0] if arr else None  # 先頭参照\n    arr.append(99)  # 末尾追加\n    last = arr.pop() if arr else None  # 末尾削除\n\n    for i, value in enumerate(arr):  # 添字つき走査\n        pass\n\n    parts = [ch.upper() for ch in s]  # 文字ごと変換\n    merged = "".join(parts)  # 文字列結合\n    return first, last, merged`,
  },
  {
    title: "Hash Map / Set",
    focus: "辞書と集合の文法",
    points: [
      "存在確認は set、対応関係や回数は dict を使う。",
      "dict.get(key, default) と in の使い分けに慣れる。",
    ],
    orders: [
      { operation: "key in dict / set", time: "平均 O(1)", space: "O(1)" },
      { operation: "dict[key] = value", time: "平均 O(1)", space: "O(1)" },
      { operation: "hash 衝突時", time: "最悪 O(n)", space: "O(1)" },
      { operation: "要素 n 個保持", time: "-", space: "O(n)" },
    ],
    template: `# Hash Map / Set の基本文法\ndef hashmap_set_basics(words):\n    counts = {}  # 文字列 -> 出現回数\n    seen = set()  # 出現済みの集合\n\n    for word in words:\n        counts[word] = counts.get(word, 0) + 1  # 回数更新\n        seen.add(word)  # 集合に追加\n\n    has_python = "python" in seen  # 存在確認\n    freq_python = counts.get("python", 0)  # 未登録なら 0\n    return has_python, freq_python, counts`,
  },
  {
    title: "Stack / Queue",
    focus: "LIFO / FIFO の操作文法",
    points: [
      "stack は list、queue は collections.deque を使う。",
      "取り出し順 (後入れ先出し / 先入れ先出し) を意識する。",
    ],
    orders: [
      { operation: "stack.append / stack.pop", time: "O(1)", space: "O(1)" },
      { operation: "deque.append / popleft", time: "O(1)", space: "O(1)" },
      { operation: "queue 全件走査", time: "O(n)", space: "O(1)" },
      { operation: "n 要素保持", time: "-", space: "O(n)" },
    ],
    template: `from collections import deque\n\n# Stack / Queue の基本文法\ndef stack_queue_basics(values):\n    stack = []\n    for value in values:\n        stack.append(value)  # push\n    top = stack.pop() if stack else None  # pop\n\n    queue = deque(values)\n    first = queue.popleft() if queue else None  # 先頭を取り出す\n    queue.append(999)  # 末尾に追加\n\n    return top, first, list(queue)`,
  },
  {
    title: "Linked List",
    focus: "ノード参照とつなぎ替え",
    points: [
      "curr.next を書き換える前に、次ノードを退避する。",
      "つなぎ替えは prev / curr / nxt の3変数で追う。",
    ],
    orders: [
      { operation: "先頭ノード参照", time: "O(1)", space: "O(1)" },
      { operation: "先頭挿入/削除", time: "O(1)", space: "O(1)" },
      { operation: "位置 i まで走査", time: "O(n)", space: "O(1)" },
      { operation: "全ノード保持", time: "-", space: "O(n)" },
    ],
    template: `# Linked List の基本文法\ndef reverse_list(head):\n    prev = None  # 反転後の前ノード\n    curr = head  # 現在ノード\n\n    while curr:\n        nxt = curr.next  # 次ノードを退避\n        curr.next = prev  # ポインタ反転\n        prev = curr  # prev を進める\n        curr = nxt  # curr を進める\n\n    return prev  # 新しい先頭`,
  },
  {
    title: "Two Pointers / Sliding Window",
    focus: "2本ポインタの移動ルール",
    points: [
      "右を広げ、条件を満たしたら左を縮める流れを固定する。",
      "left / right がいつ動くかを if / while で明確にする。",
    ],
    orders: [
      { operation: "left/right 単調移動", time: "O(n)", space: "O(1)" },
      { operation: "各要素の再訪問", time: "高々定数回", space: "-" },
      { operation: "補助配列なし", time: "-", space: "O(1)" },
    ],
    template: `# Sliding Window の基本文法\ndef window_basics(nums, limit):\n    left = 0\n    current = 0\n\n    for right, value in enumerate(nums):\n        current += value  # 右を広げる\n\n        while current > limit and left <= right:\n            current -= nums[left]  # 左を縮める\n            left += 1\n\n        # ここで [left, right] が条件を満たす区間\n\n    return left`,
  },
  {
    title: "Binary Search",
    focus: "範囲を半分に狭める文法",
    points: [
      "[left, right) か [left, right] を最初に固定する。",
      "更新時は left/right のどちらを mid に寄せるかを統一する。",
    ],
    orders: [
      { operation: "探索ステップ数", time: "O(log n)", space: "O(1)" },
      { operation: "1 回比較", time: "O(1)", space: "O(1)" },
      { operation: "再帰版", time: "O(log n)", space: "O(log n)" },
    ],
    template: `# Binary Search の基本文法 ([left, right))\ndef lower_bound(nums, target):\n    left = 0\n    right = len(nums)\n\n    while left < right:\n        mid = (left + right) // 2\n        if nums[mid] < target:\n            left = mid + 1  # 右半分へ\n        else:\n            right = mid  # 左半分へ\n\n    return left  # 条件を満たす最左位置`,
  },
  {
    title: "Recursion / Backtracking",
    focus: "再帰の書き方と巻き戻し",
    points: [
      "終了条件 -> 処理 -> 再帰呼び出し の順番を崩さない。",
      "可変オブジェクトは append 後に pop で戻す。",
    ],
    orders: [
      { operation: "深さ d の再帰呼び出し", time: "O(d)", space: "O(d)" },
      { operation: "分岐 b, 深さ d", time: "O(b^d)", space: "O(d)" },
      { operation: "結果配列保持", time: "-", space: "出力依存" },
    ],
    template: `# Recursion / Backtracking の基本文法\ndef build_paths(nums):\n    result = []\n    path = []\n\n    def dfs(index):\n        if index == len(nums):\n            result.append(path[:])  # 到達状態を保存\n            return\n\n        path.append(nums[index])  # 選ぶ\n        dfs(index + 1)\n        path.pop()  # 戻す\n\n        dfs(index + 1)  # 選ばない\n\n    dfs(0)\n    return result`,
  },
  {
    title: "Tree DFS / BFS",
    focus: "木構造の基本探索文法",
    points: [
      "DFS は再帰、BFS は queue でレベル順に処理する。",
      "None 判定を最初に置くと実装が安定する。",
    ],
    orders: [
      { operation: "DFS (全ノード訪問)", time: "O(n)", space: "O(h)" },
      { operation: "BFS (全ノード訪問)", time: "O(n)", space: "O(w)" },
      { operation: "平衡木の高さ h", time: "-", space: "O(log n)" },
    ],
    template: `# Tree DFS の基本文法\ndef preorder(root):\n    if not root:\n        return []  # 空木\n\n    left_part = preorder(root.left)  # 左部分木\n    right_part = preorder(root.right)  # 右部分木\n    return [root.val] + left_part + right_part  # 根 -> 左 -> 右`,
  },
  {
    title: "Heap / Priority Queue",
    focus: "優先度付き取り出しの文法",
    points: [
      "heapq は min-heap。最小値を高速に取り出せる。",
      "heappush と heappop をペアで使う。",
    ],
    orders: [
      { operation: "heappush", time: "O(log n)", space: "O(1)" },
      { operation: "heappop", time: "O(log n)", space: "O(1)" },
      { operation: "heap[0] 参照", time: "O(1)", space: "O(1)" },
      { operation: "heapify", time: "O(n)", space: "O(1)" },
    ],
    template: `import heapq\n\n# Heap の基本文法\ndef heap_basics(values):\n    heap = []\n\n    for value in values:\n        heapq.heappush(heap, value)  # 要素追加\n\n    smallest = heap[0] if heap else None  # 最小値参照\n    popped = heapq.heappop(heap) if heap else None  # 最小値取り出し\n\n    return smallest, popped, heap`,
  },
  {
    title: "Dynamic Programming",
    focus: "状態配列の基本文法",
    points: [
      "dp[i] の意味を先に決める。",
      "初期値と遷移式を分けて書く。",
    ],
    orders: [
      { operation: "1 次元 DP 更新", time: "O(n)", space: "O(n)" },
      { operation: "2 次元 DP 更新", time: "O(nm)", space: "O(nm)" },
      { operation: "ローリング配列最適化", time: "O(n)", space: "O(1)" },
    ],
    template: `# Dynamic Programming の基本文法\ndef dp_basics(n):\n    if n <= 1:\n        return n\n\n    dp = [0] * (n + 1)  # 状態配列\n    dp[1] = 1  # 初期値\n\n    for i in range(2, n + 1):\n        dp[i] = dp[i - 1] + dp[i - 2]  # 遷移式\n\n    return dp[n]  # 目的の状態`,
  },
];

function renderFundamentalsOrderTable(topic) {
  const rows = (topic.orders || [])
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.operation)}</td>
          <td>${escapeHtml(row.time)}</td>
          <td>${escapeHtml(row.space)}</td>
        </tr>
      `,
    )
    .join("");

  if (!rows) {
    return `<p class="detail-notes">このテーマのオーダー表は未登録です。</p>`;
  }

  return `
    <div class="fundamentals-order-wrap">
      <table class="fundamentals-order-table">
        <thead>
          <tr>
            <th>操作</th>
            <th>時間</th>
            <th>空間</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

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

function leadingSpaceCount(value) {
  const match = value.match(/^\s*/);
  return match ? match[0].length : 0;
}

function sanitizeFlowLabel(value) {
  return value
    .replaceAll('"', "'")
    .replaceAll("{", "(")
    .replaceAll("}", ")")
    .replaceAll("<", "(")
    .replaceAll(">", ")")
    .trim();
}

function normalizeFlowStep(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }
  if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
    return null;
  }

  const clipped = trimmed.length > 68 ? `${trimmed.slice(0, 65)}...` : trimmed;
  if (trimmed.startsWith("if ")) {
    return { kind: "decision", label: `条件: ${sanitizeFlowLabel(clipped.slice(3))}` };
  }
  if (trimmed.startsWith("elif ")) {
    return { kind: "decision", label: `追加条件: ${sanitizeFlowLabel(clipped.slice(5))}` };
  }
  if (trimmed === "else:") {
    return { kind: "decision", label: "それ以外" };
  }
  if (trimmed.startsWith("for ")) {
    return { kind: "loop", label: sanitizeFlowLabel(clipped) };
  }
  if (trimmed.startsWith("while ")) {
    return { kind: "loop", label: sanitizeFlowLabel(clipped) };
  }
  if (trimmed.startsWith("return ") || trimmed === "return") {
    return { kind: "return", label: `戻り値: ${sanitizeFlowLabel(clipped)}` };
  }
  if (trimmed.startsWith("break") || trimmed.startsWith("continue")) {
    return { kind: "process", label: `繰り返し制御: ${sanitizeFlowLabel(clipped)}` };
  }

  return { kind: "process", label: `処理: ${sanitizeFlowLabel(clipped)}` };
}

function extractPrimaryMethodLines(solution) {
  const lines = solution.split(/\r?\n/);
  const methodHeaderIndex = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed.startsWith("def ") || trimmed.startsWith("async def ");
  });

  if (methodHeaderIndex === -1) {
    return lines;
  }

  const methodIndent = leadingSpaceCount(lines[methodHeaderIndex]);
  const body = [];
  for (let index = methodHeaderIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const indent = leadingSpaceCount(line);
    if (indent <= methodIndent && (trimmed.startsWith("def ") || trimmed.startsWith("async def ") || trimmed.startsWith("class "))) {
      break;
    }
    body.push(line);
  }

  return body.length ? body : lines;
}

function extractFlowSteps(solution) {
  const lines = extractPrimaryMethodLines(solution);
  const steps = [];
  const maxSteps = 48;

  for (const line of lines) {
    const step = normalizeFlowStep(line);
    if (step) {
      steps.push(step);
    }
    if (steps.length >= maxSteps) {
      steps.push({ kind: "ellipsis", label: "以降の処理も続く" });
      break;
    }
  }

  return steps;
}

function buildFlowchartDefinition(problem) {
  const steps = extractFlowSteps(problem.solution);
  const title = sanitizeFlowLabel(`${problem.id} ${problem.title}`);
  const definitions = ["flowchart TD", `N0([開始: ${title}])`, "NEND([終了])"];
  const edges = [];
  let previous = "N0";
  let index = 1;
  let hasReturn = false;
  let hasLinearStep = false;

  for (const step of steps) {
    const nodeId = `N${index}`;
    index += 1;

    if (step.kind === "decision") {
      definitions.push(`${nodeId}{"${step.label}"}`);
    } else if (step.kind === "loop") {
      definitions.push(`${nodeId}["繰り返し: ${step.label}"]`);
    } else if (step.kind === "return") {
      definitions.push(`${nodeId}(["${step.label}"])`);
      hasReturn = true;
    } else if (step.kind === "ellipsis") {
      definitions.push(`${nodeId}["${step.label}"]`);
    } else {
      definitions.push(`${nodeId}["${step.label}"]`);
    }

    edges.push(`${previous} --> ${nodeId}`);

    if (step.kind === "return") {
      edges.push(`${nodeId} --> NEND`);
      continue;
    }

    previous = nodeId;
    hasLinearStep = true;
  }

  if (!hasReturn || hasLinearStep) {
    edges.push(`${previous} --> NEND`);
  }

  return [...definitions, ...edges].join("\n");
}

async function renderBrowseFlowchart() {
  const block = document.getElementById("flowchart-block");
  if (!block) {
    return;
  }

  const source = block.textContent;
  if (!source || typeof window.mermaid === "undefined") {
    return;
  }

  try {
    if (!window.__algoboardMermaidInitialized) {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        securityLevel: "loose",
        themeVariables: {
          fontFamily: "Bahnschrift, Yu Gothic UI, sans-serif",
          primaryColor: "#fff6ea",
          primaryTextColor: "#2d241c",
          primaryBorderColor: "#c79a70",
          lineColor: "#8f6a47",
          tertiaryColor: "#f4efe7",
        },
      });
      window.__algoboardMermaidInitialized = true;
    }

    const chartId = `algoboard-flow-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const rendered = await window.mermaid.render(chartId, source);
    block.innerHTML = rendered.svg;
    block.classList.add("is-rendered");
  } catch {
    block.classList.add("flowchart-fallback");
  }
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

function strategyAdvice(problem) {
  if (PROBLEM_HINTS[problem.id]) {
    return PROBLEM_HINTS[problem.id];
  }

  const tags = problem.tags.map((tag) => tag.toLowerCase());
  const advice = [];

  if (tags.some((tag) => tag.includes("sliding window"))) {
    advice.push("区間を1つ持って、右を伸ばしながら条件を壊したら左を縮める流れで考えます。");
  }
  if (tags.some((tag) => tag.includes("binary search"))) {
    advice.push("答えそのものか、答えになりうる範囲を二分探索できないかを先に疑います。");
  }
  if (tags.some((tag) => tag.includes("dynamic programming"))) {
    advice.push("小さい部分問題の答えから今の答えを作れないか、状態と遷移を紙に出します。");
  }
  if (tags.some((tag) => tag.includes("backtracking"))) {
    advice.push("選ぶ・選ばない、または次に置ける候補を順番に試す再帰木を意識します。");
  }
  if (tags.some((tag) => tag.includes("tree"))) {
    advice.push("各ノードに来たとき『親から何を受け取り、子に何を返すか』を決めると書きやすいです。");
  }
  if (tags.some((tag) => tag.includes("bfs"))) {
    advice.push("最短手数やレベル順なら BFS を疑い、キューに何を入れるかを先に決めます。");
  }
  if (tags.some((tag) => tag.includes("dfs"))) {
    advice.push("探索しながら更新する値と、再帰を抜ける条件を先に整理すると実装が安定します。");
  }
  if (tags.some((tag) => tag.includes("heap"))) {
    advice.push("毎回ほしいのが最大・最小の上位 k 件なら heap で保てないか考えます。");
  }
  if (tags.some((tag) => tag.includes("hash"))) {
    advice.push("何をキーにすれば一発で引けるかを決めると、実装がかなり短くなります。");
  }
  if (tags.some((tag) => tag.includes("linked list"))) {
    advice.push("ポインタを動かす問題は、今どのノードを見ていて next をどうつなぎ替えるかを図にします。");
  }
  if (tags.some((tag) => tag.includes("two pointers"))) {
    advice.push("左右または fast/slow の2本を置いて、それぞれがいつ動くかを条件で固定します。");
  }
  if (tags.some((tag) => tag.includes("stack"))) {
    advice.push("後から来たものを先に処理する構造か、対応関係を戻りながら確認する問題かを見ます。");
  }
  if (tags.some((tag) => tag.includes("greedy"))) {
    advice.push("今の最善を選んでも後で損しない理由を、1文で説明できるか確認します。");
  }
  if (tags.some((tag) => tag.includes("prefix sum"))) {
    advice.push("区間和を高速に出したいなら、累積和と『過去に何があったか』の記録を考えます。");
  }

  if (!advice.length) {
    advice.push("まず入出力を確認して、愚直に書くと何が遅いのかを言葉にすると次の一手が見えます。");
  }

  advice.push("最後に、関数シグネチャに対して『必要な変数』『ループ or 再帰』『返り値』の順で骨組みを書くと進めやすいです。");
  return advice;
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

async function clearAppCache() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }

    localStorage.removeItem(STORAGE_KEYS.drafts);
    localStorage.removeItem(STORAGE_KEYS.solveDrafts);
    localStorage.removeItem(STORAGE_KEYS.mastery);

    state.drafts = {};
    state.solveDrafts = {};
    state.mastery = {};
    state.solveTests = {};
    state.solveResults = {};
    state.cacheStatus = "キャッシュと保存データを削除しました。再読み込みで最新状態になります。";
  } catch (error) {
    state.cacheStatus = `削除に失敗しました: ${String(error.message || error)}`;
  }
}

async function clearCacheAndSyncStatus() {
  await clearAppCache();
  if (cacheStatus) {
    cacheStatus.textContent = state.cacheStatus;
  }
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
  if (state.viewMode === "fundamentals") {
    detailPanel.innerHTML = renderFundamentalsPanel();
    bindDetailEvents(currentProblem() || { id: "" });
    return;
  }

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
      ${
        activeProblem.notes
          ? `<p class="detail-notes">${activeProblem.notes}</p>`
          : `<div class="notes-advice">
              ${strategyAdvice(activeProblem).map((line) => `<p class="detail-notes">${line}</p>`).join("")}
            </div>`
      }
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
  if (state.viewMode === "browse") {
    renderBrowseFlowchart();
  }
}

function renderBrowsePanel(problem) {
  const flowchartDefinition = buildFlowchartDefinition(problem);

  return `
    <section class="detail-section">
      <h3>Solution</h3>
      <pre><code>${escapeHtml(problem.solution)}</code></pre>
    </section>

    <section class="detail-section">
      <h3>Flowchart</h3>
      <p class="detail-notes">解答コードのメソッド本体をもとに、条件分岐・ループ・戻り値を日本語で図示しています。長い処理は「以降の処理も続く」として省略表示します。</p>
      <div id="flowchart-block" class="flowchart-block mermaid">${escapeHtml(flowchartDefinition)}</div>
    </section>
  `;
}

function renderFundamentalsPanel() {
  const totalTopics = FUNDAMENTALS_TRACK.length;
  const safeIndex = Math.min(Math.max(state.fundamentalsTopicIndex, 0), totalTopics - 1);
  state.fundamentalsTopicIndex = safeIndex;
  const topic = FUNDAMENTALS_TRACK[safeIndex];

  return `
    <section class="detail-section fundamentals-panel">
      <div class="practice-header">
        <div>
          <h3>Fundamentals</h3>
          <p class="detail-notes">アルゴリズムとデータ構造の基本文法を、用途とテンプレートで横断的に学ぶモードです。</p>
        </div>
      </div>

      <div class="fundamentals-nav">
        <button class="action-button" data-action="fund-prev" ${safeIndex === 0 ? "disabled" : ""}>前のテーマ</button>
        <label class="filter fundamentals-topic-select-wrap">
          <span>Theme</span>
          <select id="fundamentals-topic-select">
            ${FUNDAMENTALS_TRACK.map((entry, index) => `<option value="${index}" ${index === safeIndex ? "selected" : ""}>${index + 1}. ${entry.title}</option>`).join("")}
          </select>
        </label>
        <button class="action-button" data-action="fund-next" ${safeIndex === totalTopics - 1 ? "disabled" : ""}>次のテーマ</button>
      </div>

      <section class="fundamentals-intro">
        <div class="prompt-card">
          <strong>使い方</strong>
          <ul class="constraint-list">
            <li>まずは 1 カテゴリ選び、テンプレを手打ちで再現する。</li>
            <li>次にサンプル入力を 2 つ作って挙動を確認する。</li>
            <li>慣れたら同カテゴリの問題に戻って Practice / Solve で実戦する。</li>
          </ul>
        </div>
      </section>

      <article class="practice-card fundamentals-card fundamentals-single-card">
        <div class="practice-card-head">
          <strong>${safeIndex + 1}. ${topic.title}</strong>
          <span>${topic.focus}</span>
        </div>

        <ul class="constraint-list">
          ${topic.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}
        </ul>

        <section class="detail-section fundamentals-order-section">
          <h3>Order</h3>
          ${renderFundamentalsOrderTable(topic)}
        </section>

        <pre><code>${escapeHtml(topic.template)}</code></pre>
      </article>
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
          <button class="action-button accent-button toggle-answer-button ${revealed ? "is-on" : ""}" data-action="toggle-answer" aria-pressed="${revealed ? "true" : "false"}">
            <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb"></span></span>
            <span>${revealed ? "答えを隠す" : "答えを見る"}</span>
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
          <button class="action-button accent-button toggle-answer-button ${revealed ? "is-on" : ""}" data-action="toggle-answer" aria-pressed="${revealed ? "true" : "false"}">
            <span class="toggle-track" aria-hidden="true"><span class="toggle-thumb"></span></span>
            <span>${revealed ? "解答を隠す" : "解答を見る"}</span>
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
  const fundamentalsTopicSelect = document.getElementById("fundamentals-topic-select");
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

  if (fundamentalsTopicSelect) {
    fundamentalsTopicSelect.addEventListener("change", (event) => {
      state.fundamentalsTopicIndex = Number(event.target.value) || 0;
      renderDetail();
    });
  }

  detailPanel.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", async () => {
      const { action, value } = element.dataset;

      if (action === "toggle-answer") {
        state.revealedAnswers[problem.id] = !state.revealedAnswers[problem.id];
        renderDetail();
      }

      if (action === "fund-prev") {
        state.fundamentalsTopicIndex = Math.max(0, state.fundamentalsTopicIndex - 1);
        renderDetail();
      }

      if (action === "fund-next") {
        state.fundamentalsTopicIndex = Math.min(FUNDAMENTALS_TRACK.length - 1, state.fundamentalsTopicIndex + 1);
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
  clearCacheButton?.addEventListener("click", async () => {
    if (clearCacheModal?.showModal) {
      clearCacheModal.showModal();
      return;
    }
    if (window.confirm("キャッシュと保存データを削除します。よろしいですか？")) {
      await clearCacheAndSyncStatus();
    }
  });

  clearCacheCancel?.addEventListener("click", () => {
    clearCacheModal?.close();
  });

  clearCacheConfirm?.addEventListener("click", async () => {
    clearCacheModal?.close();
    await clearCacheAndSyncStatus();
  });

  clearCacheModal?.addEventListener("click", (event) => {
    const dialog = event.currentTarget;
    const rect = dialog.getBoundingClientRect();
    const isOutside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (isOutside) {
      clearCacheModal.close();
    }
  });
  if (cacheStatus) {
    cacheStatus.textContent = state.cacheStatus;
  }

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
