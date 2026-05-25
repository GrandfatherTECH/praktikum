import { useQuery } from "@tanstack/react-query";

import { listDepartments } from "../api/departments";
import { listUsers } from "../api/users";

export function useUsersQuery(enabled = true) {
  return useQuery({
    queryKey: ["users"],
    queryFn: listUsers,
    enabled,
  });
}

export function useDepartmentsQuery() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: listDepartments,
  });
}
