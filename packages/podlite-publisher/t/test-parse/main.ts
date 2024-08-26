import React from 'react'

/**
=begin pod
=head1 factorial

Calculates the factorial of a non-negative integer. The factorial of a number n is the product of all positive integers less than or equal to n. The function uses recursion to compute the factorial, multiplying n by the factorial of n-1 until n reaches 1 or 0. If the input is less than 0, it throws an error indicating that factorial is not defined for negative numbers.

=head2 Parameters

  =begin item
  B<n>
  
  A non-negative integer for which the factorial is to be calculated.
  =end item

=head2 Returns

Returns the factorial of the number n as a number. If n is 0 or 1, it returns 1.

=end pod
*/
function factorial(n: number): number {
  if (n < 0) {
    throw new Error('Factorial is not defined for negative numbers')
  }
  if (n === 0 || n === 1) {
    return 1
  }
  return n * factorial(n - 1)
}

const num = 5
console.log(`Factorial of ${num} is ${factorial(num)}`)
