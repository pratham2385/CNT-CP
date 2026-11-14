#include <climits>
#include <algorithm>
using namespace std;

int depth(TreeNode* root) {
    if(root==NULL){return 0;}
    int rightMax = depth(root->right;)
    rightMax++;
    int leftMax = depth(root->left);
    leftMax++;
    return max(rightMax,leftMax);
}

int main() {
    depth(root);
    return 0;
}