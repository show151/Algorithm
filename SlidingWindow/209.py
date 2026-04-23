class Solution:
    def minSubArrayLen(self, target, nums):
        left = 0
        curr_sum = 0  
        min_length = float('inf')
        for right in range(len(nums)):
            curr_sum += nums[right] 
            while curr_sum >= target and left<=right: 
                min_length = min(min_length,right - left + 1)
                curr_sum -= nums[left]  
                left +=1 
        return 0 if min_length == float('inf') else min_length