import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

const buttonVariants = cva('button', {
  variants: {
    variant: { primary: 'button-primary', outline: 'button-outline', ghost: 'button-ghost' },
  },
  defaultVariants: { variant: 'primary' },
})

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants> & {
  asChild?: boolean
}

export function Button({ asChild, className, variant, type, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button'
  return <Component className={buttonVariants({ variant, className })} type={asChild ? undefined : type ?? 'button'} {...props} />
}
