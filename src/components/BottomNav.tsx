
import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { CalendarDays, Calendar, FileText, User, LogOut, MoreHorizontal, Users, BookOpen, AppWindow } from "lucide-react"; // Added AppWindow
import { usePrivy } from "@privy-io/react-auth";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { usePaidInvoiceStatus } from "@/hooks/usePaidInvoiceStatus";
import { useMenuVisibility } from "@/hooks/useMenuVisibility";

const BottomNav = () => {
  const { user, logout } = usePrivy();
  const { hasPaidInvoice, isAdmin } = usePaidInvoiceStatus(user?.id);
  const { showOnboarding } = useMenuVisibility(user?.id); // Keep this for showOnboarding only

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full border-t bg-white">
      <div className="grid h-14 grid-cols-4 items-center">
        {/* Events - Common for both admin and non-admin */}
        <NavLink
          to="/events"
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center justify-center text-xs",
              isActive
                ? "text-primary"
                : "text-gray-500 hover:text-primary"
            )
          }
        >
          {({ isActive }) => (
            <>
              <Calendar
                className={cn("mb-1 h-5 w-5", isActive && "fill-primary/10")}
              />
              <span>Events</span>
            </>
          )}
        </NavLink>

        {isAdmin ? (
          <>
            {/* Invoices (admin only) */}
            <NavLink
              to="/invoices"
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center text-xs",
                  isActive
                    ? "text-primary"
                    : "text-gray-500 hover:text-primary"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <FileText
                    className={cn("mb-1 h-5 w-5", isActive && "fill-primary/10")}
                  />
                  <span>Invoices</span>
                </>
              )}
            </NavLink>

            {/* Users (admin only) */}
            <NavLink
              to="/user-management"
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center text-xs",
                  isActive
                    ? "text-primary"
                    : "text-gray-500 hover:text-primary"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Users
                    className={cn("mb-1 h-5 w-5", isActive && "fill-primary/10")}
                  />
                  <span>Users</span>
                </>
              )}
            </NavLink>
          </>
        ) : (
          <>
            {/* Book (non-admin only) */}
            <NavLink
              to="/book"
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center text-xs",
                  isActive
                    ? "text-primary"
                    : "text-gray-500 hover:text-primary"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <CalendarDays
                    className={cn("mb-1 h-5 w-5", isActive && "fill-primary/10")}
                  />
                  <span>Book</span>
                </>
              )}
            </NavLink>

            {/* ZuLink Apps (non-admin only, if paid invoice exists) */}
            {hasPaidInvoice && (
              <NavLink
                to="/zulink-apps"
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center text-xs",
                    isActive
                      ? "text-primary"
                      : "text-gray-500 hover:text-primary"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <AppWindow
                      className={cn("mb-1 h-5 w-5", isActive && "fill-primary/10")}
                    />
                    <span>ZuLink Apps</span>
                  </>
                )}
              </NavLink>
            )}
            {/* Placeholder if user doesn't have paid invoice to maintain grid columns */}
            {!hasPaidInvoice && <div />}
          </>
        )}

        {/* More Menu for both admin and non-admin */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex flex-col items-center justify-center text-xs text-gray-500 hover:text-primary">
              <MoreHorizontal className="mb-1 h-5 w-5" />
              <span>More</span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="w-56 p-0">
            <div className="flex flex-col py-2">
              {/* Onboarding (moved from main nav to More menu for non-admin with paid invoice) */}
              {!isAdmin && showOnboarding && hasPaidInvoice && (
                <NavLink
                  to="/onboarding"
                  className="flex items-center px-3 py-2 text-sm hover:bg-primary/5"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Onboarding
                </NavLink>
              )}

              {/* Common menu items for both admin and non-admin */}
              <NavLink 
                to="/profile" 
                className="flex items-center px-3 py-2 text-sm hover:bg-primary/5"
              >
                <User className="h-4 w-4 mr-2" />
                Profile
              </NavLink>
              
              <div className="border-t my-2"></div>
              
              <button
                onClick={() => logout()}
                className="flex items-center px-3 py-2 text-sm text-red-500 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default BottomNav;
