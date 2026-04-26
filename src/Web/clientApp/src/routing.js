"use client";

import NextLink from "next/link";
import {
  useParams as useNextParams,
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from "next/navigation";

export function Link({ to, href, ...props }) {
  return <NextLink href={href ?? to ?? "#"} {...props} />;
}

export function useNavigate() {
  const router = useRouter();

  return (to, options = {}) => {
    if (typeof to === "number") {
      if (to < 0) {
        router.back();
        return;
      }

      router.forward();
      return;
    }

    if (!to) {
      return;
    }

    if (options.replace) {
      router.replace(to);
      return;
    }

    router.push(to);
  };
}

export function useParams() {
  return useNextParams();
}

export function useSearchParams() {
  return [useNextSearchParams()];
}

export function useLocation() {
  const pathname = usePathname();
  const searchParams = useNextSearchParams();
  const search = searchParams?.toString();

  return {
    pathname,
    search: search ? `?${search}` : "",
    state: null,
  };
}
